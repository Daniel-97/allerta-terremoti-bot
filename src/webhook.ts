export function verifySecretToken(request: Request, expected: string): boolean {
  const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (got === null) return false;
  return got === expected;
}
