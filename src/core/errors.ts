/** Error HTTP controlado (negocio o capa de aplicación). */
export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}
