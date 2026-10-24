/**
 * Glitch — Spotify connect (optional)
 * Authorization Code with PKCE (no client secret needed — safe for frontend).
 * Offers mood/phase-based playlist suggestions once connected.
 */
const AUTH = "https://accounts.spotify.com/authorize";
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
const REDIRECT = (import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string) ||
  (typeof window !== "undefined" ? `${window.location.origin}/spotify/callback` : "");
const SCOPES = ["user-read-email", "playlist-read-private", "user-modify-playback-state"];

export function isSpotifyConfigured(): boolean { return !!CLIENT_ID; }
export function isSpotifyConnected(): boolean { return !!localStorage.getItem("glitch_spotify_token"); }

function base64url(bytes: ArrayBuffer): string {
  let str = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const arr = new Uint8Array(64); crypto.getRandomValues(arr);
  const verifier = base64url(arr.buffer);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(digest) };
}

export async function connectSpotify(): Promise<void> {
  if (!CLIENT_ID) throw new Error("Spotify not configured");
  const { verifier, challenge } = await pkce();
  sessionStorage.setItem("glitch_spotify_verifier", verifier);
  const url = new URL(AUTH);
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT);
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  window.location.href = url.toString();
}

/** Mood/phase-based playlist suggestion (works even before connecting). */
export function suggestPlaylist(opts: { phase?: string | null; mode: string; mood?: number }): { title: string; vibe: string; query: string } {
  if (opts.mode === "menopause") return { title: "Calm & Cool", vibe: "soothing, grounding", query: "calm instrumental focus" };
  if (opts.mood != null && opts.mood <= 2) return { title: "Gentle Lift", vibe: "warm, comforting", query: "feel good acoustic" };
  switch (opts.phase) {
    case "menstrual": return { title: "Soft Rest", vibe: "slow, cozy", query: "cozy chill lofi" };
    case "follicular": return { title: "Rising Energy", vibe: "upbeat, fresh", query: "upbeat pop workout" };
    case "ovulation": return { title: "Peak Power", vibe: "high energy", query: "high energy hype" };
    case "luteal": return { title: "Steady Calm", vibe: "mellow, steady", query: "mellow r&b chill" };
    default: return { title: "Your Flow", vibe: "balanced", query: "focus flow" };
  }
}
