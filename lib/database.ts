import { getSupabaseAdminClient } from './supabase';
// No public API accepts SQL. This bridge executes existing business transactions
// in PostgreSQL through a service-role-only RPC. There is no local database.
function literal(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Valeur numérique invalide.');
    return String(value);
  }
  if (typeof value === 'boolean') return value ? '1' : '0';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (text.includes('\0')) throw new Error('Caractère invalide.');
  return "E'" + text.replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
}
export function postgresStatement(sql: string, args: unknown[]) {
  sql = sql.replace(/json_extract\(([\w.]+),'\$\.([\w]+)'\)/g, "($1 ->> '$2')");
  sql = sql.replace(/changes\(\)/g, '$1');
  let index = 0, quoted = false, out = '';
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'") {
      out += char;
      if (quoted && sql[i + 1] === "'") { out += sql[++i]; continue; }
      quoted = !quoted;
    } else if (char === '?' && !quoted) {
      if (index >= args.length) throw new Error('Paramètre SQL manquant.');
      out += literal(args[index++]);
    } else out += char;
  }
  if (quoted || index !== args.length) throw new Error('Paramètres SQL incohérents.');
  return out;
}
function normalize(row: Record<string, any>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key,
    value && typeof value === 'object' ? JSON.stringify(value) : value]));
}
export class Statement {
  constructor(readonly sql: string, readonly args: unknown[] = []) {}
  bind(...args: unknown[]) { return new Statement(this.sql, args); }
  async first() { return (await execute([this]))[0].results[0] ?? null; }
  async all() { return (await execute([this]))[0]; }
  async run() { return (await execute([this]))[0]; }
}
async function execute(statements: Statement[]) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Configuration Supabase serveur manquante.');
  const {data, error} = await client.rpc('cargo_execute', {
    statements: statements.map(q => postgresStatement(q.sql, q.args))
  });
  if (error) {
    console.error('Supabase transaction failed:', error.code, error.message);
    if (error.code === 'PGRST202' || String(error.message||'').includes('cargo_execute'))
      throw new Error('Exécutez la migration 05_server_transactions.sql dans Supabase SQL Editor.');
    if (error.code === '42P01' && /cargo_uploads|service_tasks/.test(String(error.message)))
      throw new Error('Exécutez la migration 06_uploads_and_services.sql dans Supabase SQL Editor.');
    if (error.code === '23505') throw new Error('Cette référence existe déjà. Actualisez le dossier.');
    throw new Error('Erreur de base de données. Consultez les journaux serveur ou vérifiez les migrations.');
  }
  return (data as any[]).map(r => ({results: (r.rows ?? []).map(normalize), meta: {changes: Number(r.changes ?? 0)}}));
}
export const database = {
  prepare(sql: string) { return new Statement(sql); },
  batch(statements: Statement[]) { return execute(statements); }
};
