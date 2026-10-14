import { cookies } from "next/headers";
import { validateAdminSession } from "@/lib/supabase-service";

export type AdminUser = {
  userId: string;
  displayName: string;
};

export async function getAdminUser(): Promise<AdminUser | null> {
  if ((globalThis as any).__testUser !== undefined) {
    return (globalThis as any).__testUser;
  }
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("kc_admin")?.value;
    if (!sessionToken) return null;
    const adminPassword = (globalThis as any).__testEnv?.ADMIN_TEST_PASSWORD || process.env.ADMIN_TEST_PASSWORD || "admin";
    const valid = await validateAdminSession(sessionToken, "admin", adminPassword);
    if (!valid) return null;
    return {
      userId: "admin",
      displayName: "Direction TRANSWORLD DELIVERY",
    };
  } catch {
    return null;
  }
}
