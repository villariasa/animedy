// Response helpers matching the ApiResponse envelope used by the Node
// backend ({ success, http_code, message, data }) so the frontend can share
// one response shape across both APIs.

export function ok<T>(data: T, message: string, httpCode = 200): Response {
  return Response.json(
    { success: true, http_code: httpCode, message, data },
    { status: httpCode }
  );
}

export function fail(message: string, httpCode: number): Response {
  return Response.json(
    { success: false, http_code: httpCode, message, data: null },
    { status: httpCode }
  );
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
