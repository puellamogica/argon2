export interface VerifyRequestBody {
  user_input: string;
  stored_hash: string;
}

export interface VerifyResponse {
  success: boolean;
  errcode: number;
}
