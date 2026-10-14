export class StoreError extends Error {
  readonly code: string;
  readonly status: number;
  readonly extra?: Record<string, unknown>;

  constructor(code: string, status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.name = "StoreError";
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

export function storeErrorResponse(err: unknown): { body: Record<string, unknown>; status: number } | null {
  if (!(err instanceof StoreError)) return null;
  return {
    status: err.status,
    body: { error: err.message, code: err.code, ...(err.extra ?? {}) },
  };
}
