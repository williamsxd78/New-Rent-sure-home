import React, { useEffect, useState } from "react";
import { Loader2, CheckCircle2, ShieldCheck } from "lucide-react";

/**
 * Premium full-screen "processing" overlay shown after the user clicks submit
 * on key flows (payment, final application submission). Plays a sequence of
 * stage checkmarks to convey real backend work and build trust.
 *
 * @param {object} props
 * @param {boolean} props.open - controls visibility
 * @param {Array<{label: string, duration?: number}>} props.stages - stage labels & per-stage timing in ms
 * @param {string} [props.title] - header text
 * @param {string} [props.subtitle] - sub-header text
 * @param {function} props.onDone - fired once the final stage completes
 * @param {string} [props.testid]
 */
export default function SubmittingOverlay({ open, stages, title, subtitle, onDone, testid }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) { setActive(0); return; }
    let cancelled = false;
    let i = 0;
    const runNext = () => {
      if (cancelled) return;
      const dur = stages[i]?.duration ?? 1000;
      setActive(i);
      setTimeout(() => {
        if (cancelled) return;
        i += 1;
        if (i >= stages.length) {
          // small grace pause on the final checkmark
          setTimeout(() => { if (!cancelled) onDone?.(); }, 700);
        } else {
          runNext();
        }
      }, dur);
    };
    runNext();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-[#0A192F]/85 backdrop-blur-sm flex items-center justify-center p-4 rs-fade-in"
      data-testid={testid || "submitting-overlay"}
      role="dialog"
      aria-live="polite"
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl">
        <div className="w-14 h-14 rounded-full bg-[#0A192F]/5 flex items-center justify-center mx-auto mb-5 relative">
          <Loader2 className="w-7 h-7 text-[#0A192F] animate-spin" />
          <div className="absolute inset-0 rounded-full border-2 border-[#C5A880]/30 animate-ping" />
        </div>
        <h3 className="font-display text-xl font-bold text-[#0A192F] text-center">{title || "Processing…"}</h3>
        {subtitle && <p className="text-sm text-slate-500 text-center mt-1.5 leading-relaxed">{subtitle}</p>}

        <ul className="mt-6 space-y-2.5" data-testid="overlay-stages">
          {stages.map((s, i) => {
            const done = i < active;
            const current = i === active;
            return (
              <li
                key={i}
                className={`flex items-center gap-3 text-sm transition-all duration-300 ${current ? "text-[#0A192F]" : done ? "text-emerald-700" : "text-slate-400"}`}
                data-testid={`overlay-stage-${i}`}
                data-stage-state={done ? "done" : current ? "active" : "pending"}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${done ? "bg-emerald-500 text-white" : current ? "bg-[#0A192F] text-white" : "bg-slate-100 text-slate-400"}`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : current ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="text-[10px] font-semibold">{i + 1}</span>}
                </div>
                <span className={current ? "font-medium" : ""}>{s.label}</span>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          256-bit encrypted &middot; Do not close this window
        </div>
      </div>
    </div>
  );
}
