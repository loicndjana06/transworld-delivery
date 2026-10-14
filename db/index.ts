import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { runtimeEnv } from "@/lib/runtime";

let dbInstance: any;
try {
  dbInstance = drizzle(runtimeEnv.DB as any, { schema });
} catch {
  console.warn('[AI Studio] Drizzle fallback active');
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({})
  };
  dbInstance = new Proxy({}, {
    get: (_, prop) => prop === 'query' ? new Proxy({}, { get: () => noOp }) : async () => [],
  });
}

export function getDb() {
  return dbInstance;
}

export { dbInstance as db };
