import React, { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

/**
 * Secure 9-digit SSN input.
 *
 * Implementation: a normal text input holds the formatted value (`XXX-XX-XXXX`)
 * so typing, paste, caret, selection and mobile keyboards all work natively.
 * When `show=false`, the input text is made transparent (caret stays visible)
 * and an absolutely-positioned overlay renders the masked form `•••-••-••••`
 * with real dashes. Toggling the eye makes the input text visible again.
 *
 * This works in every browser (no dependency on `-webkit-text-security`).
 */
export default function SecureSSNInput({ value, onChange, required, testid = "f-ssn-full" }) {
  const [show, setShow] = useState(false);
  const digits = (value || "").replace(/\D/g, "").slice(0, 9);
  const formatted =
    digits.length <= 3 ? digits :
    digits.length <= 5 ? `${digits.slice(0, 3)}-${digits.slice(3)}` :
    `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;

  // Build masked display: same layout as `formatted`, but every digit replaced
  // with a bullet. Dashes stay visible → `•••-••-••••` style.
  const maskedDisplay = formatted.replace(/\d/g, "•");

  const handleChange = (e) => {
    onChange(e.target.value.replace(/\D/g, "").slice(0, 9));
  };

  return (
    <div className="relative" data-testid={`${testid}-wrap`}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        className="rs-input pr-20 font-mono tracking-wider"
        style={!show ? { color: "transparent", caretColor: "#0A192F" } : undefined}
        value={formatted}
        onChange={handleChange}
        placeholder="XXX-XX-XXXX"
        maxLength={11}
        required={required}
        data-testid={testid}
        aria-label="Social Security Number"
      />
      {/* Masked overlay — visible only when hidden and at least 1 digit entered */}
      {!show && digits.length > 0 && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 right-20 px-4 flex items-center font-mono tracking-wider text-[#0A192F] select-none pointer-events-none"
        >
          {maskedDisplay}
        </div>
      )}
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
