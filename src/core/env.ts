export type NodeEnv = 'development' | 'production' | 'test';

export type AppEnv = Readonly<{
  NODE_ENV: NodeEnv;
  PORT: number;
  JWT_SECRET: string;
  DATABASE_URL: string | undefined;
  /** Duración del access JWT (jsonwebtoken, p. ej. `15m`, `1h`). */
  JWT_ACCESS_EXPIRES_IN: string;
  /** Días de validez del refresh token opaco. */
  JWT_REFRESH_DAYS: number;
}>;

function parsePort(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65_535) {
    throw new Error(`PORT inválido: "${raw}". Debe ser un entero entre 1 y 65535.`);
  }
  return n;
}

function parseNodeEnv(raw: string | undefined): NodeEnv {
  const v = (raw ?? 'development').toLowerCase();
  if (v === 'development' || v === 'production' || v === 'test') return v;
  throw new Error(
    `NODE_ENV inválido: "${raw}". Valores permitidos: development, production, test.`,
  );
}

function parseJwtRefreshDays(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return 7;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 365) {
    throw new Error(
      `JWT_REFRESH_DAYS inválido: "${raw}". Debe ser un entero entre 1 y 365.`,
    );
  }
  return n;
}

/**
 * Lee y valida variables de entorno. Llamar después de cargar dotenv (p. ej. en server.ts).
 */
export function loadEnv(): AppEnv {
  const NODE_ENV = parseNodeEnv(process.env.NODE_ENV);
  const PORT = parsePort(process.env.PORT, 3000);
  const DATABASE_URL =
    process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== ''
      ? process.env.DATABASE_URL
      : undefined;

  const jwtRaw = process.env.JWT_SECRET?.trim() ?? '';
  if (NODE_ENV === 'production') {
    if (jwtRaw.length < 32) {
      throw new Error(
        'En producción JWT_SECRET es obligatorio y debe tener al menos 32 caracteres.',
      );
    }
    if (!DATABASE_URL) {
      throw new Error('En producción DATABASE_URL es obligatorio.');
    }
  }

  const JWT_SECRET =
    jwtRaw.length > 0 ? jwtRaw : 'dev-secret-change-me-not-for-production';

  const JWT_ACCESS_EXPIRES_IN =
    process.env.JWT_ACCESS_EXPIRES_IN?.trim() || '15m';
  const JWT_REFRESH_DAYS = parseJwtRefreshDays(process.env.JWT_REFRESH_DAYS);

  return Object.freeze({
    NODE_ENV,
    PORT,
    JWT_SECRET,
    DATABASE_URL,
    JWT_ACCESS_EXPIRES_IN,
    JWT_REFRESH_DAYS,
  });
}
