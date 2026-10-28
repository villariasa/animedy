/** Error type shared by the AniList/AniSkip clients. httpCode 0 = network/offline. */
export class ApiError extends Error {
  readonly httpCode: number;

  constructor(message: string, httpCode: number) {
    super(message);
    this.name = "ApiError";
    this.httpCode = httpCode;
  }
}
