export const ErrCode = {
  OK: 0,
  INVALID_REQUEST: 1,
  MISMATCH: 2,
  INVALID_HASH: 3,
  UNSUPPORTED_HASH: 4,
  PAYLOAD_TOO_LARGE: 5,
  INTERNAL_ERROR: 6,
  UNAUTHORIZED: 7,
  METHOD_NOT_ALLOWED: 8,
} as const;

export type ErrCodeValue = (typeof ErrCode)[keyof typeof ErrCode];
