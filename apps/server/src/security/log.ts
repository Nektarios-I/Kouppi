export function logServerEvent(
  event: string,
  meta: Record<string, string | number | boolean | null | undefined> = {}
): void {
  const entry = {
    ts: new Date().toISOString(),
    event,
    ...meta,
  };
  console.log(JSON.stringify(entry));
}
