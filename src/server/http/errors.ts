export type ErrorCode =
  | 'bad_request'
  | 'validation'
  | 'unauthorized'
  | 'mfa_required'
  | 'forbidden'
  | 'csrf'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'internal';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message?: string,
    readonly fields?: Record<string, string>,
    readonly headers?: Record<string, string>,
  ) {
    super(message ?? code);
  }
}

export const notFound = () => new ApiError(404, 'not_found');
export const forbidden = () => new ApiError(403, 'forbidden');
export const conflict = (message?: string) => new ApiError(409, 'conflict', message);
