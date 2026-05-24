import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Mail, Lock, Save } from "lucide-react";

export default function AdminSettingsPage() {
  const [s, setS] = useState({ smtp: {}, ssn_allow_download: false, ssn_retention_days: 30 });
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.get("/admin/settings").then((r) => setS({ smtp: {}, ssn_allow_download: false, ssn_retention_days: 30, ...r.data })); }, []);

  const save = async () => {
    await api.put("/admin/settings", s);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const updateSmtp = (k, v) => setS({ ...s, smtp: { ...(s.smtp || {}), [k]: v } });

  return (
    <div className="p-6 lg:p-10 max-w-3xl" data-testid="admin-settings">
      <h1 className="font-display text-3xl font-bold text-[#0A192F] mb-2">Settings</h1>
      <p className="text-sm text-slate-500 mb-8">Configure SMTP, SSN handling, and retention policies.</p>

      <div className="rs-card p-7 mb-6">
        <div className="flex items-center gap-2 mb-4"><Mail className="w-5 h-5 text-[#C5A880]" /><h2 className="font-display font-semibold text-[#0A192F]">SMTP Configuration</h2></div>
        <p className="text-xs text-slate-500 mb-4">Email notifications will be sent once SMTP is configured. Until then, emails are queued/logged only.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="rs-label">Host</label><input className="rs-input" value={s.smtp?.host || ""} onChange={(e) => updateSmtp("host", e.target.value)} placeholder="smtp.gmail.com" data-testid="smtp-host" /></div>
          <div><label className="rs-label">Port</label><input className="rs-input" type="number" value={s.smtp?.port || ""} onChange={(e) => updateSmtp("port", Number(e.target.value))} placeholder="587" data-testid="smtp-port" /></div>
          <div><label className="rs-label">Username</label><input className="rs-input" value={s.smtp?.username || ""} onChange={(e) => updateSmtp("username", e.target.value)} data-testid="smtp-user" /></div>
          <div><label className="rs-label">Password</label><input className="rs-input" type="password" value={s.smtp?.password || ""} onChange={(e) => updateSmtp("password", e.target.value)} data-testid="smtp-pass" /></div>
          <div className="sm:col-span-2"><label className="rs-label">From Email</label><input className="rs-input" value={s.smtp?.from_email || ""} onChange={(e) => updateSmtp("from_email", e.target.value)} placeholder="no-reply@rentsurehomes.com" data-testid="smtp-from" /></div>
        </div>
      </div>

      <div className="rs-card p-7 mb-6">
        <div className="flex items-center gap-2 mb-4"><Lock className="w-5 h-5 text-[#C5A880]" /><h2 className="font-display font-semibold text-[#0A192F]">SSN Document Handling</h2></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.ssn_allow_download} onChange={(e) => setS({ ...s, ssn_allow_download: e.target.checked })} data-testid="ssn-allow-dl" /> Allow Super Admin to download full SSN documents</label>
        <div className="mt-4"><label className="rs-label">SSN Document Retention (days after rejection/withdrawal)</label><input type="number" className="rs-input" value={s.ssn_retention_days} onChange={(e) => setS({ ...s, ssn_retention_days: Number(e.target.value) })} data-testid="ssn-retention" /></div>
      </div>

      <button onClick={save} className="rs-btn-primary" data-testid="save-settings"><Save className="w-4 h-4" /> Save Settings</button>
      {saved && <span className="ml-3 text-sm text-emerald-600">Saved.</span>}
    </div>
  );
}
