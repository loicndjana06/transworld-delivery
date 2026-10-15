import { database } from './database';
import { isSupabaseConfigured } from './supabase';
import { uploadToStorage, getFromStorage, deleteFromStorage, createPrivateUploadUrl, createPrivateDownloadUrl, checkPrivateBucket } from './supabase-service';
const testEnv = () => process.env.NODE_ENV === 'test' ? (globalThis as any).__testEnv : undefined;
const value = (key: string, fallback = '') => testEnv()?.[key] ?? process.env[key] ?? fallback;
const bucket = {
  createUploadUrl:createPrivateUploadUrl,
  downloadUrl:createPrivateDownloadUrl,
  check:checkPrivateBucket,
  async put(key: string, bytes: Uint8Array | ArrayBuffer, options?: {httpMetadata?: {contentType?: string}}) {
    await uploadToStorage(key, bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), options?.httpMetadata?.contentType || 'application/octet-stream');
  },
  async get(key: string) {
    const file = await getFromStorage(key);
    return file ? {body: file.body, arrayBuffer: async () => file.body.slice().buffer, httpMetadata: {contentType: file.mime}} : null;
  },
  async delete(key: string) { await deleteFromStorage(key); }
};
export const runtimeEnv = {
  get DB() { return testEnv()?.DB ?? (isSupabaseConfigured() ? database : null); },
  get BUCKET() { return testEnv()?.BUCKET ?? (isSupabaseConfigured() ? bucket : null); },
  get ADMIN_TEST_PASSWORD() { return value('ADMIN_TEST_PASSWORD'); },
  get ADMIN_USER_ID() { return value('ADMIN_USER_ID', '1d932391-a77a-4527-9b6d-1d7d4e884b4e'); },
  get MAP_TILE_URL() { return value('MAP_TILE_URL', 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'); },
  get MAP_TILE_ATTRIBUTION() { return value('MAP_TILE_ATTRIBUTION', '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'); },
  get EMAIL_API_KEY() { return value('EMAIL_API_KEY'); },
  get EMAIL_FROM() { return value('EMAIL_FROM'); }
};
