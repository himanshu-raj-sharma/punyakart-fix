export type BusinessErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'DUPLICATE_RECORD'
  | 'PERSISTENCE_ERROR'
  | 'UNAUTHORIZED';

export class BusinessError extends Error {
  constructor(
    message: string,
    public readonly code: BusinessErrorCode,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}