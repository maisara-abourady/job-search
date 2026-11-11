/**
 * AB-5: the app listens only on the owner's machine and is never exposed to the internet. There is no login, so
 * anything that can reach the port can read every profile. Binding to loopback (the web Main's job) is not enough
 * on its own: a web page the owner visits can send requests to localhost (cross-site requests) or rebind its own
 * hostname to 127.0.0.1 (DNS rebinding). The web Main's route handlers therefore refuse any request whose Host,
 * or whose Origin when present, is not a loopback name (ADR 0016). Framework-free: plain header values in.
 */
export const LOOPBACK_BIND_ADDRESS = "127.0.0.1";
const LOOPBACK_NAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function hostnameOf(hostHeader: string): string {
  const h = hostHeader.trim().toLowerCase();
  if (h.startsWith("[")) return h.slice(0, h.indexOf("]") + 1);
  return h.split(":")[0] ?? "";
}

export function acceptsLocalRequest(headers: { readonly host: string | null; readonly origin: string | null }): boolean {
  if (headers.host === null || !LOOPBACK_NAMES.has(hostnameOf(headers.host))) return false;
  if (headers.origin === null) return true;
  // An Origin is "scheme://host[:port]"; anything else, including the opaque origin "null", is refused.
  const match = /^https?:\/\/(\[[^\]]+\]|[^/:]+)(?::\d+)?$/i.exec(headers.origin.trim());
  return match !== null && LOOPBACK_NAMES.has((match[1] ?? "").toLowerCase());
}
