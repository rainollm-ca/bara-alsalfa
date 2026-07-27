export function readInviteCode(search: string) {
  const code = new URLSearchParams(search).get("room")?.toUpperCase() ?? "";
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}
