import { cookies } from 'next/headers';
import { runtimeEnv } from './runtime';
import { hashString } from './supabase-service';
export type AdminUser = {userId: string; displayName: string};
export async function getAdminUser(): Promise<AdminUser | null> {
  if (process.env.NODE_ENV === 'test' && (globalThis as any).__testUser !== undefined)
    return (globalThis as any).__testUser;
  const password = runtimeEnv.ADMIN_TEST_PASSWORD;
  if (!password || !runtimeEnv.DB) return null;
  const cookie = (await cookies()).get('kc_admin')?.value;
  if (!cookie || !/^[a-f0-9]{48}$/.test(cookie)) return null;
  try { const row = await runtimeEnv.DB.prepare('SELECT id FROM admin_sessions WHERE id=? AND owner=? AND expires>?')
    .bind(await hashString(cookie + password), runtimeEnv.ADMIN_USER_ID, new Date().toISOString()).first();
  return row ? {userId: runtimeEnv.ADMIN_USER_ID, displayName: 'Direction TRANSWORLD DELIVERY'} : null;
  } catch { return null; }
}
