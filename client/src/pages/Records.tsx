/**
 * Luna — Health Records
 * Upload files/images OR type values (BP, labs, diagnoses). Everything is stored
 * locally in IndexedDB and NEVER leaves the device. Explicit consent first.
 */
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { FileText, Upload, Plus, Trash2, Shield } from "lucide-react";

export default function Records() {
  const { profile, records, addRecord, removeRecord, reload } = useApp();
  const [consented, setConsented] = useState(profile?.consentRecords ?? false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");

  async function grantConsent() {
    setConsented(true);
    const { profileRepo } = await import("@/db/repositories");
    await profileRepo.update({ consentRecords: true });
    await reload();
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      await addRecord({ kind: "file", label: f.name, fileName: f.name, mimeType: f.type, blob: f, date: new Date().toISOString().split("T")[0] });
    }
    toast.success("Stored on your device 🔒");
  }

  async function addValue() {
    if (!label || !value) { toast.error("Add a label and value"); return; }
    await addRecord({ kind: "value", label, value, unit, date: new Date().toISOString().split("T")[0] });
    setLabel(""); setValue(""); setUnit("");
    toast.success("Value saved 🔒");
  }

  if (!consented) {
    return (
      <div className="luna-app" style={{ minHeight: "100%", padding: "28px 20px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "var(--luna-accent)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px var(--luna-glow)" }}>
          <Shield size={28} color="white" />
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "var(--luna-text)" }}>Your records, your device</h1>
        <p style={{ fontSize: 14, color: "var(--luna-text-muted)", lineHeight: 1.6 }}>
          You can store health documents, lab results, and values like blood pressure here. Everything is kept
          <b> only on this device</b> in your browser's local database. Nothing is uploaded to any server, and
          Luna never shares it. You can delete anything anytime.
        </p>
        <ul style={{ fontSize: 13, color: "var(--luna-text-muted)", lineHeight: 1.8, paddingLeft: 18 }}>
          <li>🔒 Stored locally (IndexedDB) — never leaves your phone</li>
          <li>🗑️ Delete any record instantly</li>
          <li>📄 Useful context when you talk to a clinician</li>
        </ul>
        <motion.button whileTap={{ scale: 0.97 }} onClick={grantConsent}
          style={{ padding: 15, borderRadius: 14, background: "var(--luna-accent)", color: "white", fontWeight: 700, border: "none", boxShadow: "0 8px 22px var(--luna-glow)" }}>
          I understand — enable records
        </motion.button>
      </div>
    );
  }

  return (
    <div className="luna-app" style={{ minHeight: "100%", padding: "22px 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--luna-text)" }}>Health records</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--luna-text-muted)" }}>
        <Shield size={13} /> Stored only on this device
      </div>

      {/* Upload */}
      <div onClick={() => fileRef.current?.click()}
        style={{ padding: 20, borderRadius: 18, background: "var(--luna-surface)", border: "2px dashed var(--luna-accent)", textAlign: "center", cursor: "pointer" }}>
        <Upload size={26} color="var(--luna-accent)" style={{ margin: "0 auto 8px" }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--luna-text)" }}>Upload a document or image</p>
        <p style={{ fontSize: 11, color: "var(--luna-text-muted)" }}>Lab results, scans, notes — PDF or image</p>
        <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt,.doc,.docx" style={{ display: "none" }} onChange={(e) => onFiles(e.target.files)} />
      </div>

      {/* Typed value */}
      <div style={{ padding: 16, borderRadius: 18, background: "var(--luna-surface)", boxShadow: "0 4px 16px oklch(0.2 0.02 50 / 0.06)" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--luna-text)", marginBottom: 10 }}>Or type a value</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Blood pressure" style={inp} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 120/80" style={{ ...inp, flex: 2 }} />
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unit" style={{ ...inp, flex: 1 }} />
          <motion.button whileTap={{ scale: 0.95 }} onClick={addValue} style={{ padding: "0 16px", borderRadius: 10, background: "var(--luna-accent)", color: "white", border: "none" }}><Plus size={18} /></motion.button>
        </div>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {records.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--luna-text-muted)", textAlign: "center", padding: 16 }}>No records yet.</p>
        ) : records.map((r) => (
          <motion.div key={r.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "var(--luna-surface)" }}>
            <FileText size={18} color="var(--luna-accent)" />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--luna-text)" }}>{r.label}</p>
              <p style={{ fontSize: 11, color: "var(--luna-text-muted)" }}>
                {r.kind === "value" ? `${r.value} ${r.unit ?? ""}` : r.mimeType ?? "file"} · {r.date}
              </p>
            </div>
            <button onClick={async () => { await removeRecord(r.id!); toast("Removed"); }} style={{ background: "none", border: "none", color: "var(--luna-text-muted)" }}><Trash2 size={16} /></button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  flex: 1, padding: "10px 12px", borderRadius: 10, border: "1.5px solid oklch(0.85 0.02 72)",
  background: "var(--luna-bg)", color: "var(--luna-text)", fontSize: 13, outline: "none",
};
