export function createCardInstanceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `tea-timer-${crypto.randomUUID()}`;
  }

  const randomPart = Math.random().toString(16).slice(2, 10);
  const timestampPart = Date.now().toString(16);
  return `tea-timer-${timestampPart}-${randomPart}`;
}
