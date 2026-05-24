import React, { useState, useEffect } from "react";
import { MessageCircle, X, Mail, Phone, Send, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

/**
 * Floating support widget for public pages. Shows a launcher in the
 * bottom-right corner that expands into a contact panel with quick
 * channels and a simple message form. The message is sent to the
 * existing /api/contact endpoint (placeholder until live chat is wired).
 */
export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState({ state: "idle", msg: "" });

  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 6000);
    return () => clearTimeout(t);
  }, []);

  const send = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setStatus({ state: "sending", msg: "" });
    try {
      await api.post("/contact", form);
      setStatus({ state: "ok", msg: "Thanks! Our team will get back to you within 1 business day." });
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      setStatus({ state: "err", msg: err?.response?.data?.detail || "Could not send. Please try email or phone instead." });
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => { setOpen(true); setPulse(false); }}
          aria-label="Open support"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-[#0A192F] text-white pl-4 pr-5 py-3 shadow-lg shadow-[#0A192F]/30 hover:bg-[#102a4a] transition group"
          data-testid="support-launcher"
        >
          <span className="relative inline-flex">
            <MessageCircle className="w-5 h-5 text-[#C5A880]" />
            {pulse && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#C5A880] animate-ping" />}
            {pulse && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#C5A880]" />}
          </span>
          <span className="text-sm font-medium hidden sm:inline">Need help?</span>
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-6 right-6 z-40 w-[92vw] sm:w-[380px] max-h-[80vh] rs-fade-in rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-[#0A192F]/20 flex flex-col overflow-hidden"
          data-testid="support-panel"
        >
          <div className="bg-[#0A192F] text-white px-5 py-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#C5A880] font-semibold">RentSure Support</div>
              <div className="font-display font-semibold text-base mt-0.5">How can we help?</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close support" className="text-slate-300 hover:text-white" data-testid="support-close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-5 py-4 border-b border-slate-100 grid grid-cols-2 gap-2">
            <a href="mailto:support@rentsurehomes.com" className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 transition" data-testid="support-email">
              <Mail className="w-4 h-4 text-[#C5A880]" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Email</div>
                <div className="text-xs text-[#0A192F] font-medium">support</div>
              </div>
            </a>
            <a href="tel:+18005551234" className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 transition" data-testid="support-phone">
              <Phone className="w-4 h-4 text-[#C5A880]" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Call</div>
                <div className="text-xs text-[#0A192F] font-medium">1-800-555-1234</div>
              </div>
            </a>
          </div>

          {status.state === "ok" ? (
            <div className="p-6 text-center" data-testid="support-success">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <div className="font-display text-lg font-semibold text-[#0A192F]">Message sent</div>
              <p className="text-sm text-slate-600 mt-2">{status.msg}</p>
              <button onClick={() => setStatus({ state: "idle", msg: "" })} className="rs-btn-outline mt-5 !py-2 text-sm" data-testid="support-send-another">
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={send} className="p-5 space-y-3 overflow-y-auto" data-testid="support-form">
              <div className="text-xs text-slate-500 leading-relaxed">
                Send us a quick note and our team will reply within 1 business day. Live chat is coming soon.
              </div>
              <input
                className="rs-input text-sm" placeholder="Your name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required
                data-testid="support-name"
              />
              <input
                type="email" className="rs-input text-sm" placeholder="Email address" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} required
                data-testid="support-email-input"
              />
              <textarea
                rows={4} className="rs-input text-sm" placeholder="How can we help?" value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })} required
                data-testid="support-message"
              />
              {status.state === "err" && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2" data-testid="support-error">{status.msg}</div>
              )}
              <button
                type="submit" disabled={status.state === "sending"}
                className="rs-btn-primary w-full justify-center disabled:opacity-60"
                data-testid="support-send"
              >
                <Send className="w-4 h-4" /> {status.state === "sending" ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
