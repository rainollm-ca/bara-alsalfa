export function readInviteCode(search: string) {
  const code = new URLSearchParams(search).get("room")?.toUpperCase() ?? "";
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

export function buildInviteUrl(code: string) {
  return `https://lamma.rainomotion.com/?room=${encodeURIComponent(code.toUpperCase())}`;
}
