import { PrismaClient } from '@prisma/client';

function buildRuntimeDatabaseUrl(): string | undefined {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return undefined;

  // Quando usando Supabase/pgBouncer, evitar prepared statements no pool transacional.
  const forcePgBouncer =
    process.env.PRISMA_USE_PGBOUNCER === 'true' || rawUrl.includes('pooler.supabase.com');

  if (!forcePgBouncer) {
    return rawUrl;
  }

  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has('pgbouncer')) {
      url.searchParams.set('pgbouncer', 'true');
    }
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '1');
    }
    if (!url.searchParams.has('sslmode')) {
      url.searchParams.set('sslmode', 'require');
    }
    return url.toString();
  } catch {
    // Se não for possível parsear, mantém valor original para não bloquear boot.
    return rawUrl;
  }
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: buildRuntimeDatabaseUrl(),
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;

