import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { isSupabaseConfigured } from './supabase';
import { uploadToStorage, getFromStorage, deleteFromStorage } from './supabase-service';

// Local storage directory
const DATA_DIR = join(process.cwd(), '.local-data');
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = join(DATA_DIR, 'transworld.db');
const dbInstance = new DatabaseSync(DB_PATH);
dbInstance.exec('PRAGMA foreign_keys = ON;');

// Run migrations from drizzle folder if not already run
const drizzleDir = join(process.cwd(), 'drizzle');
if (existsSync(drizzleDir)) {
  const files = readdirSync(drizzleDir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    try {
      const sql = readFileSync(join(drizzleDir, f), 'utf-8');
      const statements = sql.split('--> statement-breakpoint');
      for (const stmt of statements) {
        const trimmed = stmt.trim();
        if (trimmed) {
          try {
            dbInstance.exec(trimmed);
          } catch {
            // Table/column might already exist from previous run
          }
        }
      }
    } catch (e) {
      console.warn(`Error running migration ${f}:`, e);
    }
  }
  try {
    dbInstance.exec('ALTER TABLE settings ADD COLUMN tile_url text NOT NULL DEFAULT "";');
  } catch {}
  try {
    dbInstance.exec('ALTER TABLE settings ADD COLUMN tile_attribution text NOT NULL DEFAULT "";');
  } catch {}
}

class Statement {
  private sql: string;
  private args: any[];

  constructor(sql: string, args: any[] = []) {
    this.sql = sql;
    this.args = args;
  }

  bind(...args: any[]) {
    return new Statement(this.sql, args);
  }

  async first(): Promise<any> {
    try {
      const stmt = dbInstance.prepare(this.sql);
      const row = stmt.get(...this.args);
      return row ?? null;
    } catch (e) {
      console.error('SQL first error:', this.sql, this.args, e);
      throw e;
    }
  }

  async all(): Promise<{ results: any[]; meta: { changes: number } }> {
    try {
      const stmt = dbInstance.prepare(this.sql);
      const rows = stmt.all(...this.args);
      return { results: rows as any[], meta: { changes: 0 } };
    } catch (e) {
      console.error('SQL all error:', this.sql, this.args, e);
      throw e;
    }
  }

  async run(): Promise<{ meta: { changes: number }; results: any[] }> {
    try {
      const stmt = dbInstance.prepare(this.sql);
      const res = stmt.run(...this.args);
      return { meta: { changes: Number(res.changes) }, results: [] };
    } catch (e) {
      console.error('SQL run error:', this.sql, this.args, e);
      throw e;
    }
  }
}

const DB = {
  prepare(sql: string) {
    return new Statement(sql);
  },
  async batch(statements: Statement[]) {
    dbInstance.exec('BEGIN');
    try {
      const results = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      dbInstance.exec('COMMIT');
      return results;
    } catch (e) {
      dbInstance.exec('ROLLBACK');
      throw e;
    }
  }
};

// Files directory for BUCKET
const FILES_DIR = join(DATA_DIR, 'files');
if (!existsSync(FILES_DIR)) {
  mkdirSync(FILES_DIR, { recursive: true });
}

function safeFilePath(key: string): string {
  const sanitized = key.replace(/[^a-zA-Z0-9_\-./]/g, '_');
  return join(FILES_DIR, sanitized);
}

const BUCKET = {
  async put(key: string, bytes: Uint8Array | ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }) {
    const filePath = safeFilePath(key);
    const parent = join(filePath, '..');
    if (!existsSync(parent)) {
      mkdirSync(parent, { recursive: true });
    }
    const buf = bytes instanceof Uint8Array ? Buffer.from(bytes) : Buffer.from(bytes);
    writeFileSync(filePath, buf);
    if (options?.httpMetadata?.contentType) {
      writeFileSync(`${filePath}.meta`, JSON.stringify(options.httpMetadata));
    }
  },

  async get(key: string) {
    const filePath = safeFilePath(key);
    if (!existsSync(filePath)) return null;
    const buf = readFileSync(filePath);
    let contentType = 'application/octet-stream';
    if (existsSync(`${filePath}.meta`)) {
      try {
        const meta = JSON.parse(readFileSync(`${filePath}.meta`, 'utf-8'));
        if (meta.contentType) contentType = meta.contentType;
      } catch {}
    }
    return {
      body: new Uint8Array(buf),
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      httpMetadata: { contentType },
    };
  },

  async delete(key: string) {
    const filePath = safeFilePath(key);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    if (existsSync(`${filePath}.meta`)) {
      unlinkSync(`${filePath}.meta`);
    }
  }
};

export { BUCKET as localBucket };

const SupabaseBucket = {
  async put(key: string, bytes: Uint8Array | ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }) {
    const raw = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    await uploadToStorage(key, raw, options?.httpMetadata?.contentType || 'application/octet-stream');
  },
  async get(key: string) {
    const file = await getFromStorage(key);
    if (!file) return null;
    return {
      body: file.body,
      arrayBuffer: async () => file.body.buffer.slice(file.body.byteOffset, file.body.byteOffset + file.body.byteLength),
      httpMetadata: { contentType: file.mime },
    };
  },
  async delete(key: string) {
    await deleteFromStorage(key);
  }
};

export const runtimeEnv = {
  get DB() {
    if ((globalThis as any).__testEnv?.DB) return (globalThis as any).__testEnv.DB;
    if (isSupabaseConfigured()) return DB;
    return null;
  },
  get BUCKET() {
    if ((globalThis as any).__testEnv?.BUCKET) return (globalThis as any).__testEnv.BUCKET;
    if (isSupabaseConfigured()) return SupabaseBucket;
    return null;
  },
  get ADMIN_TEST_PASSWORD() {
    return (globalThis as any).__testEnv?.ADMIN_TEST_PASSWORD || process.env.ADMIN_TEST_PASSWORD || 'admin';
  },
  get GOOGLE_MAPS_API_KEY() {
    return (globalThis as any).__testEnv?.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
  },
  get GOOGLE_MAPS_MAP_ID() {
    return (globalThis as any).__testEnv?.GOOGLE_MAPS_MAP_ID || process.env.GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
  },
  get MAP_TILE_URL() {
    return (globalThis as any).__testEnv?.MAP_TILE_URL || process.env.MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  },
  get MAP_TILE_ATTRIBUTION() {
    return (globalThis as any).__testEnv?.MAP_TILE_ATTRIBUTION || process.env.MAP_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
  },
  get EMAIL_API_KEY() {
    return (globalThis as any).__testEnv?.EMAIL_API_KEY || process.env.EMAIL_API_KEY || '';
  },
  get EMAIL_FROM() {
    return (globalThis as any).__testEnv?.EMAIL_FROM || process.env.EMAIL_FROM || '';
  },
};
