/**
 * Glitch — Your data & privacy controls
 * Shows where data lives and gives the user export, disconnect and delete-everything controls.
 */
import { Download, Lock, Trash2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const INK = "var(--ink)";
const MUTED = "var(--txt-muted)";
const font = "'DM Sans', sans-serif";

export default function PrivacyCard() {
  const { whoop, disconnectWhoop, exportMyData, deleteAllMyData } = useApp();
  const row = { display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 12, border: "1.5px solid var(--line)", background: "var(--card-bg)", width: "100%", textAlign: "left" as const };

  return (
    <div style={{ background: "var(--card-bg)", borderRadius: 22, padding: 16, boxShadow: "0 4px 16px oklch(0.25 0.025 50 / 0.06)" }}>
      <div className="flex items-center gap-2 mb-1">
        <Lock size={16} style={{ color: "oklch(0.84 0.12 148)" }} />
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: INK }}>Your data & privacy</p>
      </div>
      <p style={{ fontSize: 12, color: MUTED, fontFamily: font, lineHeight: 1.5, marginBottom: 12 }}>
        Everything is encrypted (AES-256) on this device with a key that can't leave it. Form Coach video never leaves your phone. WHOOP data is only read with your permission.
      </p>
      <div className="flex flex-col gap-2">
        <button style={row} onClick={() => { exportMyData(); toast.success("Your data was downloaded as JSON"); }}>
          <Download size={16} style={{ color: INK }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: INK, fontFamily: font }}>Export all my data</span>
        </button>
        {whoop && (
          <button style={row} onClick={() => { disconnectWhoop(); toast.success("WHOOP disconnected and its data removed"); }}>
            <Unplug size={16} style={{ color: INK }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: INK, fontFamily: font }}>Disconnect WHOOP {whoop.source === "demo" ? "(demo)" : ""}</span>
          </button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button style={{ ...row, borderColor: "oklch(0.62 0.15 30 / 0.4)" }}>
              <Trash2 size={16} style={{ color: "oklch(0.84 0.17 30)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "oklch(0.84 0.17 30)", fontFamily: font }}>Delete everything</span>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete all your data?</AlertDialogTitle>
              <AlertDialogDescription>
                This erases your profile, logs, cycle history and WHOOP data from this device, and destroys the encryption key. It can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteAllMyData()}>Delete everything</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
