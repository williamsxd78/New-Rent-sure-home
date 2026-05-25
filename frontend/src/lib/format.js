// Lightweight US-style formatters used across the application.

/** Strip non-digits and cap length. */
export const onlyDigits = (s, max = 999) => (s || "").replace(/\D/g, "").slice(0, max);

/**
 * Format a US phone number as `(XXX) XXX-XXXX` while the user types.
 * Accepts any input; non-digits are stripped. Returns a partial format
 * for incomplete numbers (e.g. `(415)`, `(415) 555`).
 */
export const formatPhone = (raw) => {
  const d = onlyDigits(raw, 10);
  if (d.length === 0) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
};

/**
 * Format a money string (kept as a string for controlled <input>) with commas.
 * Returns `""` when empty. Strips any non-digit input.
 */
export const formatMoneyInput = (raw) => {
  const d = onlyDigits(String(raw ?? ""), 9);
  if (!d) return "";
  return Number(d).toLocaleString("en-US");
};

/** Reverse: extract numeric value from a formatted money string. */
export const parseMoneyInput = (raw) => {
  const d = onlyDigits(String(raw ?? ""), 9);
  return d ? Number(d) : "";
};

/** Today as ISO date `YYYY-MM-DD` (used to auto-fill the signature date field). */
export const todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
