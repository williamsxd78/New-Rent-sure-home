import React, { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

/**
 * Secure 9-digit SSN input.
 * - Uses `type="password"` when hidden so the browser handles per-character masking
 *   natively — fixes the bug where the bullets-as-value approach trapped input
 *   after the first digit
 * - Toggle reveals the formatted SSN (`XXX-XX-XXXX`) via `type="text"`
 * - Backend value (via onChange) is always the raw 9-digit string with no dashes
 */
export default function SecureSSNInput({ value, onChange, required, testid = "f-ssn-full" }) {
  const [show, setShow] = useState(false);
  const digits = (value || "").replace(/\D/g, "").slice(0, 9);
  const formatted =
    digits.length <= 3 ? digits :
    digits.length <= 5 ? `${digits.slice(0, 3)}-${digits.slice(3)}` :
    `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;

  const handleChange = (e) => {
    // Always strip dashes/spaces; cap at 9 digits
    onChange(e.target.value.replace(/\D/g, "").slice(0, 9));
  };

  return (
    <div className="relative" data-testid={`${testid}-wrap`}>
      <input
        type={show ? "text" : "password"}
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        className="rs-input pr-20 font-mono tracking-wider"
        value={show ? formatted : digits}
        onChange={handleChange}
        placeholder={show ? "XXX-XX-XXXX" : "Enter 9 digits"}
        maxLength={show ? 11 : 9}
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
          tabIndex={-1}
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
 */
export function maskedSSN(value) {
  const d = (value || "").replace(/\D/g, "");
  if (d.length < 4) return "•••-••-••••";
  return `•••-••-${d.slice(-4)}`;
}
