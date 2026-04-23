import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool, type PoolConfig } from 'pg';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
  pgPool: Pool;
};

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error('DATABASE_URL no está definido. Agrégalo a tu .env (local) o a las variables de Render.');
}

function poolConfigFromUrl(connectionString: string): PoolConfig {
  const base: PoolConfig = {
    connectionString,
    connectionTimeoutMillis: 20_000,
    max: 10,
  };

  try {
    const u = new URL(connectionString);
    const sslmode = u.searchParams.get('sslmode');
    const host = u.hostname;
    const isCloudHost =
      host.includes('render.com') ||
      host.endsWith('.neon.tech') ||
      host.includes('supabase.co');
    const needsSsl =
      sslmode === 'require' ||
      sslmode === 'verify-full' ||
      sslmode === 'no-verify' ||
      isCloudHost;

    if (!needsSsl) {
      return base;
    }

    u.searchParams.delete('sslmode');
    const cleanConnectionString = u.toString();

    return {
      ...base,
      connectionString: cleanConnectionString,
      ssl: { rejectUnauthorized: false },
      ...(isCloudHost ? { family: 4 as const } : {}),
    };
  } catch {
    return base;
  }
}

const pool = globalForPrisma.pgPool ?? new Pool(poolConfigFromUrl(databaseUrl));
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: ['query', 'info', 'warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}

export default prisma;