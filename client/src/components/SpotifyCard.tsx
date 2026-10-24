/**
 * Glitch — Spotify connect card
 * Offers a phase/mood-matched playlist and a "connect Spotify" option.
 */
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { isSpotifyConfigured, connectSpotify, suggestPlaylist } from "@/lib/spotify";
import { Music } from "lucide-react";

export default function SpotifyCard() {
  const { profile, cyclePhase, todayMood } = useApp();
  const pick = suggestPlaylist({ phase: cyclePhase, mode: profile?.healthMode ?? "none", mood: todayMood });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ padding: 16, borderRadius: 18, background: "linear-gradient(135deg, oklch(0.55 0.15 150), oklch(0.45 0.12 160))", color: "white", boxShadow: "0 8px 22px oklch(0.5 0.12 150 / 0.3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "oklch(1 0 0 / 0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Music size={16} color="white" />
        </div>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>{pick.title}</h3>
          <p style={{ fontSize: 11, opacity: 0.85 }}>{pick.vibe} · matched to your {cyclePhase ?? "day"}</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <a href={`https://open.spotify.com/search/${encodeURIComponent(pick.query)}`} target="_blank" rel="noreferrer"
          style={{ flex: 1, textAlign: "center", padding: "9px", borderRadius: 10, background: "oklch(1 0 0 / 0.95)", color: "oklch(0.45 0.12 160)", fontWeight: 700, fontSize: 12, textDecoration: "none" }}>
          Open playlist
        </a>
        <motion.button whileTap={{ scale: 0.96 }}
          onClick={() => { if (!isSpotifyConfigured()) { toast.info("Add a Spotify Client ID to .env to link your account."); return; } connectSpotify(); }}
          style={{ flex: 1, padding: "9px", borderRadius: 10, background: "oklch(1 0 0 / 0.15)", color: "white", fontWeight: 700, fontSize: 12, border: "1px solid oklch(1 0 0 / 0.3)" }}>
          Connect Spotify
        </motion.button>
      </div>
    </motion.div>
  );
}
