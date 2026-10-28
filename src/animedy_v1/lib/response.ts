// Small helper for building the standard { success, http_code, message, data } envelope.

import type { ApiResponse } from "../interfaces/api.js";

export function ok<T>(data: T, message = "OK", httpCode = 200): ApiResponse<T> {
  return { success: true, http_code: httpCode, message, data };
}

export function fail(message: string, httpCode = 400): ApiResponse<null> {
  return { success: false, http_code: httpCode, message, data: null };
}
