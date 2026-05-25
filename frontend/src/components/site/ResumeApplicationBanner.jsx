import React, { useState } from "react";
import { api } from "@/lib/api";
import { Mail, RefreshCw, CheckCircle2, ShieldCheck, Clock } from "lucide-react";

/**
 * Homepage widget — applicants who left a saved draft mid-application can
 * re-request their resume link by entering their email. Anti-enumeration:
 * we ALWAYS show the same success message regardless of whether the email
 * exists in our drafts collection.
 */
export default function ResumeApplicationBanner() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | err
  const [errMsg, setErrMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes("@")) { setErrMsg("Enter a valid email"); setStatus("err"); return; }
    setStatus("sending"); setErrMsg("");
    try {
      await api.post("/applications/resend-resume-link", {
        email: email.trim().toLowerCase(),
        frontend_url: typeof window !== "undefined" ? window.location.origin : "",
      });
      setStatus("sent");
    } catch (err) {
      setStatus("err");
      setErrMsg(err?.response?.data?.detail || "Something went wrong. Please try again.");
    }
  };

  return (
    <section className="rs-section" data-testid="resume-banner">
      <div className="rs-container">
        <div className="rs-card overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Left: navy promo panel */}
            <div className="bg-[#0A192F] text-white p-8 md:p-10 relative overflow-hidden">
              <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-[#C5A880]/10" aria-hidden="true" />
              <div className="absolute -right-20 bottom-0 w-40 h-40 rounded-full bg-[#C5A880]/5" aria-hidden="true" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C5A880]/15 text-[#C5A880] text-[10px] uppercase tracking-[0.2em] font-semibold mb-4">
                  <RefreshCw className="w-3 h-3" /> Resume Application
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-bold leading-tight">
                  Picked the perfect place but stepped away?
                </h2>
                <p className="text-slate-300 mt-3 leading-relaxed text-sm">
                  Your progress is safe. Drop your email and we'll send you a one-click link to jump back in — on any device, exactly where you left off.
                </p>
                <ul className="mt-6 space-y-2.5 text-sm text-slate-200">
                  <li className="flex items-start gap-2"><ShieldCheck className="w-4 h-4 text-[#C5A880] mt-0.5 flex-shrink-0" /> Secure single-use link, expires in 7 days</li>
                  <li className="flex items-start gap-2"><Clock className="w-4 h-4 text-[#C5A880] mt-0.5 flex-shrink-0" /> Most applications finish in 8&ndash;12 minutes</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-[#C5A880] mt-0.5 flex-shrink-0" /> All your details preserved, including documents</li>
                </ul>
              </div>
            </div>
            {/* Right: form */}
            <div className="p-8 md:p-10 flex items-center">
              {status === "sent" ? (
                <div className="w-full text-center py-6" data-testid="resume-banner-success">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                  </div>
                  <h3 className="font-display text-xl font-semibold text-[#0A192F]">Check your inbox</h3>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                    If we found a saved application for <strong className="text-[#0A192F]">{email}</strong>, we just sent you a resume link.
                    Look for an email from <span className="font-mono text-xs">RentSure Homes</span>.
                  </p>
                  <button
                    onClick={() => { setStatus("idle"); setEmail(""); }}
                    className="rs-btn-outline mt-6 !py-2 text-sm"
                    data-testid="resume-banner-reset"
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} className="w-full" data-testid="resume-banner-form">
                  <label className="rs-label">Your email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C5A880] pointer-events-none" />
                    <input
                      type="email"
                      className="rs-input pl-9"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      data-testid="resume-banner-email"
                    />
                  </div>
                  {errMsg && <div className="text-xs text-red-600 mt-2" data-testid="resume-banner-error">{errMsg}</div>}
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="rs-btn-primary w-full justify-center mt-4 disabled:opacity-60"
                    data-testid="resume-banner-submit"
                  >
                    {status === "sending" ? "Sending link…" : <>Email me my resume link <RefreshCw className="w-4 h-4" /></>}
                  </button>
                  <p className="text-[11px] text-slate-400 mt-3 text-center leading-relaxed">
                    For your privacy, we don't disclose whether an account exists. If you have one, you'll receive the email.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
