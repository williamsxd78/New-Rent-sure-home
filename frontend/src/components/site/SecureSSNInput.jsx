import React, { useState, useRef } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

/**
 * Secure 9-digit SSN input.
 * - User types digits only (auto-formatted internally as XXX-XX-XXXX)
 * - Display defaults to masked (***-**-****) for shoulder-surfing protection
 * - Eye toggle reveals the raw formatted value temporarily
 * - Backend value (via onChange) is always the raw 9-digit string with no dashes
 */
export default function SecureSSNInput({ value, onChange, required, testid = "f-ssn-full" }) {
  const [show, setShow] = useState(false);
  const inputRef = useRef(null);

  const digits = (value || "").replace(/\D/g, "").slice(0, 9);

  const formatted =
    digits.length <= 3 ? digits :
    digits.length <= 5 ? `${digits.slice(0, 3)}-${digits.slice(3)}` :
    `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;

  // Mask: show position-by-position to keep caret behavior natural
  const masked = digits
    .split("")
    .map((c, i) => (i === 3 || i === 5 ? "-" + "•" : "•"))
    .join("")
    .replace(/^•/, "•"); // no-op, just to keep formatter consistent
  // Better mask: replace digits with bullets but keep dashes
  const maskedFormatted = formatted.replace(/\d/g, "•");

  const handleChange = (e) => {
    const next = e.target.value.replace(/\D/g, "").slice(0, 9);
    onChange(next);
  };

  return (
    <div className="relative" data-testid={`${testid}-wrap`}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        className="rs-input pr-20 font-mono tracking-wider"
        value={show ? formatted : maskedFormatted}
        onChange={handleChange}
        placeholder="•••-••-••••"
        maxLength={11}
        required={required}
        data-testid={testid}
        aria-label="Social Security Number"
      />
      <div className="absolute inset-y-0 right-2 flex items-center gap-1.5 text-slate-400">
        <Lock className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-[#0A192F]"
          aria-label={show ? "Hide SSN" : "Show SSN"}
          data-testid={`${testid}-toggle`}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {digits.length > 0 && digits.length < 9 && (
        <div className="text-[11px] text-amber-700 mt-1" data-testid={`${testid}-hint`}>
          SSN must be 9 digits ({digits.length}/9 entered)
        </div>
      )}
    </div>
  );
}

/**
 * Render a stored SSN with only the last 4 digits visible (used in Review / read-only).
 *   stored = "123456789"  →  "•••-••-6789"
 */
export function maskedSSN(value) {
  const d = (value || "").replace(/\D/g, "");
  if (d.length < 4) return "•••-••-••••";
  return `•••-••-${d.slice(-4)}`;
}
