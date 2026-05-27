import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Mail, Lock, Save, CreditCard, Send, CheckCircle2, AlertCircle, ExternalLink, Info, ShieldCheck, Landmark,
} from "lucide-react";

export default function AdminSettingsPage() {
  const [s, setS] = useState(null);
  const [tab, setTab] = useState("paypal");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState({ smtp: null, paypal: null });

  const load = async () => {
    const r = await api.get("/admin/settings");
    setS({
      smtp: { host: "", port: 587, username: "", password: "", from_email: "", use_tls: true, enabled: false, ...(r.data.smtp || {}) },
      paypal: { enabled: true, mode: "demo", client_id: "", client_secret: "", ...(r.data.paypal || {}) },
      bank_transfer: {
        enabled: false, bank_name: "", account_name: "", account_number: "", routing_number: "",
        bank_address: "", instructions: "", contact_email: "",
        ...(r.data.bank_transfer || {}),
      },
      ssn_allow_download: r.data.ssn_allow_download ?? false,
      ssn_retention_days: r.data.ssn_retention_days ?? 30,
    });
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true); setErrMsg(""); setSavedMsg("");
    try {
      await api.put("/admin/settings", s);
      setSavedMsg("Settings saved. Changes are live immediately.");
      setTimeout(() => setSavedMsg(""), 3500);
      load();
    } catch (e) {
      setErrMsg(e?.response?.data?.detail || "Failed to save");
    } finally { setSaving(false); }
  };

  const updateSmtp = (k, v) => setS({ ...s, smtp: { ...s.smtp, [k]: v } });
  const updatePp = (k, v) => setS({ ...s, paypal: { ...s.paypal, [k]: v } });
  const updateBt = (k, v) => setS({ ...s, bank_transfer: { ...s.bank_transfer, [k]: v } });

  const testSmtp = async () => {
    setTestResult({ ...testResult, smtp: { status: "running" } });
    try {
      const fd = new FormData(); fd.append("to_email", testEmail);
      await api.post("/admin/settings/smtp/test", fd);
      setTestResult({ ...testResult, smtp: { status: "ok", msg: `Test email sent to ${testEmail}` } });
    } catch (e) {
      setTestResult({ ...testResult, smtp: { status: "fail", msg: e?.response?.data?.detail || "Failed" } });
    }
  };

  const testPaypal = async () => {
    setTestResult({ ...testResult, paypal: { status: "running" } });
    try {
      const r = await api.post("/admin/settings/paypal/test");
      setTestResult({ ...testResult, paypal: { status: "ok", msg: `PayPal ${r.data.mode || ""} connection OK`, mode: r.data.mode } });
    } catch (e) {
      setTestResult({ ...testResult, paypal: { status: "fail", msg: e?.response?.data?.detail || "Failed" } });
    }
  };

  if (!s) return <div className="p-10 text-slate-500">Loading…</div>;

  return (
    <div className="p-6 lg:p-10 max-w-4xl" data-testid="admin-settings">
      <h1 className="font-display text-3xl font-bold text-[#0A192F] mb-2">Settings</h1>
      <p className="text-sm text-slate-500 mb-6">Configure live integrations — changes go into effect immediately.</p>

      {(() => {
        const paypalOn = s.paypal.enabled !== false;
        const bankOn = !!s.bank_transfer?.enabled;
        if (!paypalOn && !bankOn) {
          return (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3" data-testid="payment-method-warning">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">No payment methods are active</div>
                <div className="mt-0.5">Applicants currently can't pay the application fee online. Enable either <strong>PayPal</strong> or <strong>Bank Transfer</strong> below.</div>
              </div>
            </div>
          );
        }
        if (!paypalOn && bankOn) {
          return (
            <div className="mb-6 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-2" data-testid="payment-method-warning">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>PayPal is disabled — applicants will only see <strong>Bank Transfer</strong> as a payment option.</div>
            </div>
          );
        }
        return null;
      })()}

      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {[
          { k: "paypal", label: "PayPal", icon: CreditCard },
          { k: "bank", label: "Bank Transfer", icon: Landmark },
          { k: "smtp", label: "SMTP Email", icon: Mail },
          { k: "security", label: "Security & SSN", icon: ShieldCheck },
        ].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition flex items-center gap-2 ${tab === t.k ? "border-[#C5A880] text-[#0A192F]" : "border-transparent text-slate-500 hover:text-[#0A192F]"}`} data-testid={`settings-tab-${t.k}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "paypal" && (
        <div className="rs-card p-7" data-testid="paypal-section">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
            <div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-[#C5A880]" /><h2 className="font-display font-semibold text-[#0A192F] text-lg">PayPal Integration</h2></div>
            <label className="inline-flex items-center gap-2 cursor-pointer select-none" data-testid="paypal-enabled-wrap">
              <input
                type="checkbox"
                checked={s.paypal.enabled !== false}
                onChange={(e) => updatePp("enabled", e.target.checked)}
                className="w-4 h-4 accent-emerald-600"
                data-testid="paypal-enabled-toggle"
              />
              <span className={`text-sm font-medium ${s.paypal.enabled === false ? "text-slate-400" : "text-emerald-700"}`}>
                {s.paypal.enabled === false ? "Disabled" : "Enabled"}
              </span>
            </label>
          </div>
          <p className="text-sm text-slate-500 mb-5">
            {s.paypal.enabled === false
              ? "PayPal is currently disabled. Applicants will only see Bank Transfer (if enabled) on the payment step."
              : "Demo mode keeps the application fee flow simulated. Switch to Sandbox or Live and add your credentials to enable real PayPal payments — instantly."}
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="rs-label">Mode</label>
              <select className="rs-input" value={s.paypal.mode} onChange={(e) => updatePp("mode", e.target.value)} data-testid="paypal-mode">
                <option value="demo">Demo (simulated)</option>
                <option value="sandbox">Sandbox (real PayPal test)</option>
                <option value="live">Live (real money)</option>
              </select>
              {s.paypal.mode === "live" && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg mt-2 flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> Live mode will charge real customers. Test thoroughly in Sandbox first.</div>
              )}
            </div>
            <div className="sm:col-span-2 rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 leading-relaxed">
              <div className="flex items-center gap-2 text-[#0A192F] font-semibold mb-1.5"><Info className="w-4 h-4 text-[#C5A880]" /> Where do I get my credentials?</div>
              <ol className="list-decimal ml-5 space-y-1">
                <li>Sign in to <a href="https://developer.paypal.com/dashboard/applications" target="_blank" rel="noopener noreferrer" className="text-[#0A192F] underline">developer.paypal.com</a> with your PayPal business account.</li>
                <li>Go to <strong>Apps & Credentials</strong> → toggle <strong>Sandbox</strong> or <strong>Live</strong>.</li>
                <li>Open your REST API app (or create one) and copy the <strong>Client ID</strong> and <strong>Secret</strong>.</li>
                <li>Paste them below and click <strong>Save & Apply</strong>, then <strong>Test Connection</strong>.</li>
              </ol>
              <a href="https://developer.paypal.com/dashboard/applications" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-[#0A192F] font-medium">Open PayPal Developer Dashboard <ExternalLink className="w-3 h-3" /></a>
            </div>
            <div className="sm:col-span-2">
              <label className="rs-label">Client ID</label>
              <input className="rs-input font-mono text-sm" value={s.paypal.client_id} onChange={(e) => updatePp("client_id", e.target.value)} placeholder="AeA1QIZ..." data-testid="paypal-client-id" />
            </div>
            <div className="sm:col-span-2">
              <label className="rs-label">Client Secret {s.paypal.client_secret_set && <span className="text-xs text-emerald-600 font-normal ml-2">(stored — leave blank to keep)</span>}</label>
              <input type="password" className="rs-input font-mono text-sm" value={s.paypal.client_secret} onChange={(e) => updatePp("client_secret", e.target.value)} placeholder={s.paypal.client_secret_set ? "•••••••• (stored)" : "EJ12pPpW..."} data-testid="paypal-client-secret" />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button onClick={save} disabled={saving} className="rs-btn-primary" data-testid="save-paypal"><Save className="w-4 h-4" /> Save & Apply</button>
            <button onClick={testPaypal} disabled={saving} className="rs-btn-outline" data-testid="test-paypal"><CheckCircle2 className="w-4 h-4" /> Test Connection</button>
            {testResult.paypal && (
              <div className={`text-sm flex items-center gap-1.5 ${testResult.paypal.status === "ok" ? "text-emerald-700" : testResult.paypal.status === "fail" ? "text-red-700" : "text-slate-500"}`}>
                {testResult.paypal.status === "ok" && <CheckCircle2 className="w-4 h-4" />}
                {testResult.paypal.status === "fail" && <AlertCircle className="w-4 h-4" />}
                {testResult.paypal.msg || "Testing…"}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "bank" && (
        <div className="rs-card p-7" data-testid="bank-section">
          <div className="flex items-center gap-2 mb-1"><Landmark className="w-5 h-5 text-[#C5A880]" /><h2 className="font-display font-semibold text-[#0A192F] text-lg">Bank Transfer (Wire / ACH)</h2></div>
          <p className="text-sm text-slate-500 mb-5">
            Offer applicants a second payment option. When enabled, applicants will see your bank details on the payment step and can submit a transaction reference after wiring funds. You verify the transfer and mark it paid in Applications.
          </p>

          <label className="flex items-center gap-2 cursor-pointer mb-4">
            <input type="checkbox" checked={!!s.bank_transfer.enabled} onChange={(e) => updateBt("enabled", e.target.checked)} data-testid="bank-enabled" />
            <span className="text-sm font-medium text-[#0A192F]">Enable Bank Transfer as a payment option</span>
          </label>

          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="rs-label">Bank Name</label><input className="rs-input" value={s.bank_transfer.bank_name} onChange={(e) => updateBt("bank_name", e.target.value)} placeholder="Chase Bank" data-testid="bank-bank-name" /></div>
            <div><label className="rs-label">Account Holder Name</label><input className="rs-input" value={s.bank_transfer.account_name} onChange={(e) => updateBt("account_name", e.target.value)} placeholder="RentSure Homes LLC" data-testid="bank-account-name" /></div>
            <div><label className="rs-label">Account Number</label><input className="rs-input font-mono" value={s.bank_transfer.account_number} onChange={(e) => updateBt("account_number", e.target.value)} placeholder="000123456789" data-testid="bank-account-number" /></div>
            <div><label className="rs-label">Routing Number (ABA)</label><input className="rs-input font-mono" value={s.bank_transfer.routing_number} onChange={(e) => updateBt("routing_number", e.target.value)} placeholder="021000021" data-testid="bank-routing" /></div>
            <div className="sm:col-span-2"><label className="rs-label">Bank Address</label><input className="rs-input" value={s.bank_transfer.bank_address} onChange={(e) => updateBt("bank_address", e.target.value)} placeholder="270 Park Ave, New York, NY 10017" data-testid="bank-address" /></div>
            <div className="sm:col-span-2">
              <label className="rs-label">Contact Email for Transaction Submissions</label>
              <input type="email" className="rs-input" value={s.bank_transfer.contact_email} onChange={(e) => updateBt("contact_email", e.target.value)} placeholder="payments@rentsurehomes.com" data-testid="bank-contact-email" />
              <p className="text-xs text-slate-500 mt-1">Shown to applicants in the "Please submit transaction id to…" instruction.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="rs-label">Additional Instructions (optional)</label>
              <textarea rows={3} className="rs-input" value={s.bank_transfer.instructions} onChange={(e) => updateBt("instructions", e.target.value)} placeholder="Please include your Application ID in the wire memo / reference." data-testid="bank-instructions" />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button onClick={save} disabled={saving} className="rs-btn-primary" data-testid="save-bank"><Save className="w-4 h-4" /> Save & Apply</button>
            <span className="text-xs text-slate-500">Changes go live immediately on the applicant payment page.</span>
          </div>
        </div>
      )}

      {tab === "smtp" && (
        <div className="rs-card p-7" data-testid="smtp-section">
          <div className="flex items-center gap-2 mb-1"><Mail className="w-5 h-5 text-[#C5A880]" /><h2 className="font-display font-semibold text-[#0A192F] text-lg">SMTP Email</h2></div>
          <p className="text-sm text-slate-500 mb-5">
            Add your SMTP server credentials (Gmail, Mailgun, SendGrid SMTP, AWS SES, your provider) to send transactional emails: application submitted, payment received, and final decision notifications.
          </p>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 leading-relaxed mb-5">
            <div className="flex items-center gap-2 text-[#0A192F] font-semibold mb-1.5"><Info className="w-4 h-4 text-[#C5A880]" /> Quick reference</div>
            <ul className="list-disc ml-5 space-y-1">
              <li><strong>Gmail:</strong> host <code>smtp.gmail.com</code>, port <code>587</code>, TLS on. Use a <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-[#0A192F] underline">Google App Password</a> (not your regular password).</li>
              <li><strong>SendGrid SMTP:</strong> host <code>smtp.sendgrid.net</code>, port <code>587</code>, username <code>apikey</code>, password = SendGrid API key.</li>
              <li><strong>AWS SES:</strong> host <code>email-smtp.us-east-1.amazonaws.com</code>, port <code>587</code>, SMTP credentials from SES console.</li>
              <li>For port 465, also tick "Use TLS" — the system uses SSL automatically.</li>
            </ul>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!s.smtp.enabled} onChange={(e) => updateSmtp("enabled", e.target.checked)} data-testid="smtp-enabled" />
                <span className="text-sm font-medium text-[#0A192F]">Enable email sending</span>
              </label>
              <p className="text-xs text-slate-500 mt-1">When off, emails are silently skipped (the app keeps working).</p>
            </div>
            <div><label className="rs-label">SMTP Host</label><input className="rs-input" value={s.smtp.host} onChange={(e) => updateSmtp("host", e.target.value)} placeholder="smtp.gmail.com" data-testid="smtp-host" /></div>
            <div><label className="rs-label">Port</label><input className="rs-input" type="number" value={s.smtp.port} onChange={(e) => updateSmtp("port", Number(e.target.value))} placeholder="587" data-testid="smtp-port" /></div>
            <div><label className="rs-label">Username</label><input className="rs-input" value={s.smtp.username} onChange={(e) => updateSmtp("username", e.target.value)} placeholder="user@example.com" data-testid="smtp-username" /></div>
            <div><label className="rs-label">Password {s.smtp.password_set && <span className="text-xs text-emerald-600 font-normal ml-2">(stored — leave blank to keep)</span>}</label><input type="password" className="rs-input" value={s.smtp.password} onChange={(e) => updateSmtp("password", e.target.value)} placeholder={s.smtp.password_set ? "•••••••• (stored)" : "App password"} data-testid="smtp-password" /></div>
            <div className="sm:col-span-2"><label className="rs-label">From Email</label><input className="rs-input" value={s.smtp.from_email} onChange={(e) => updateSmtp("from_email", e.target.value)} placeholder="no-reply@rentsurehomes.com" data-testid="smtp-from" /></div>
            <label className="flex items-center gap-2 sm:col-span-2 text-sm">
              <input type="checkbox" checked={!!s.smtp.use_tls} onChange={(e) => updateSmtp("use_tls", e.target.checked)} data-testid="smtp-use-tls" /> Use TLS (recommended for ports 587 and 465)
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button onClick={save} disabled={saving} className="rs-btn-primary" data-testid="save-smtp"><Save className="w-4 h-4" /> Save & Apply</button>
            <div className="flex-1 min-w-[240px] max-w-md flex gap-2">
              <input type="email" className="rs-input !py-2" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" data-testid="smtp-test-email" />
              <button onClick={testSmtp} disabled={!testEmail || saving} className="rs-btn-outline !py-2 !px-4 whitespace-nowrap" data-testid="test-smtp"><Send className="w-4 h-4" /> Send Test</button>
            </div>
          </div>
          {testResult.smtp && (
            <div className={`text-sm flex items-center gap-1.5 mt-3 ${testResult.smtp.status === "ok" ? "text-emerald-700" : testResult.smtp.status === "fail" ? "text-red-700" : "text-slate-500"}`}>
              {testResult.smtp.status === "ok" && <CheckCircle2 className="w-4 h-4" />}
              {testResult.smtp.status === "fail" && <AlertCircle className="w-4 h-4" />}
              {testResult.smtp.msg || "Sending…"}
            </div>
          )}

          <div className="mt-7 pt-6 border-t border-slate-100">
            <div className="font-display font-semibold text-[#0A192F] mb-1">Email templates</div>
            <p className="text-sm text-slate-500 mb-4">Preview the HTML emails applicants receive at each milestone.</p>
            <div className="flex flex-wrap gap-2" data-testid="email-template-previews">
              {[
                { key: "application_submitted", label: "Application Submitted" },
                { key: "payment_received", label: "Payment Received" },
                { key: "decision_approved", label: "Decision: Pre-Approved" },
                { key: "decision_not_qualified", label: "Decision: Not Qualified" },
                { key: "decision_more_info", label: "Decision: More Info Needed" },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={async () => {
                    const r = await api.get(`/admin/email-templates/${t.key}/preview`, { responseType: "text" });
                    const blob = new Blob([r.data], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    window.open(url, "_blank", "noopener,noreferrer");
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                  }}
                  className="rs-btn-outline !py-1.5 !px-3 text-xs"
                  data-testid={`preview-tpl-${t.key.replace(/_/g, "-")}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "security" && (
        <div className="rs-card p-7" data-testid="security-section">
          <div className="flex items-center gap-2 mb-1"><Lock className="w-5 h-5 text-[#C5A880]" /><h2 className="font-display font-semibold text-[#0A192F] text-lg">SSN & Document Handling</h2></div>
          <p className="text-sm text-slate-500 mb-5">Govern how sensitive applicant data is stored and accessed.</p>
          <label className="flex items-center gap-2 text-sm mb-4">
            <input type="checkbox" checked={!!s.ssn_allow_download} onChange={(e) => setS({ ...s, ssn_allow_download: e.target.checked })} data-testid="ssn-allow-dl" />
            <span>Allow Super Admin to download full SSN documents (audit-logged)</span>
          </label>
          <div className="max-w-xs">
            <label className="rs-label">SSN Document Retention (days)</label>
            <input type="number" className="rs-input" value={s.ssn_retention_days} onChange={(e) => setS({ ...s, ssn_retention_days: Number(e.target.value) })} data-testid="ssn-retention" />
            <p className="text-xs text-slate-500 mt-1">After rejection/withdrawal, SSN documents are deleted after this many days.</p>
          </div>
          <button onClick={save} disabled={saving} className="rs-btn-primary mt-6"><Save className="w-4 h-4" /> Save & Apply</button>
        </div>
      )}

      {(savedMsg || errMsg) && (
        <div className={`mt-5 p-3 rounded-lg text-sm flex items-center gap-2 ${errMsg ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
          {errMsg ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />} {errMsg || savedMsg}
        </div>
      )}
    </div>
  );
}
