import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

/**
 * Resolve a property image entry to a usable URL.
 * - "storage://..." references are streamed through our /api proxy
 * - external https/http URLs are returned as-is
 */
export const resolvePropertyImage = (property, idx = 0) => {
  if (!property?.images || property.images.length === 0) return "";
  const ref = property.images[idx];
  if (!ref) return "";
  if (typeof ref === "string" && ref.startsWith("storage://")) {
    // Key the cache to the underlying file (last path segment) — without
    // this, after a delete/reorder the index URL stays the same and the
    // browser serves the previous image from cache.
    const tail = ref.split("/").pop() || "";
    const cacheKey = tail.slice(0, 16) || String(idx);
    return `${API}/properties/${property.slug || property.id}/images/${idx}?v=${encodeURIComponent(cacheKey)}`;
  }
  return ref;
};

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("rs_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const formatMoney = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

/**
 * Download the branded application confirmation PDF.
 * Triggers a real browser download (binary blob).
 */
export const downloadConfirmationPdf = async (applicationId, email) => {
  if (!applicationId || !email) throw new Error("Application ID and email are required");
  const r = await api.get(`/applications/${encodeURIComponent(applicationId)}/confirmation-pdf`, {
    params: { email },
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `RentSure-Confirmation-${applicationId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1500);
};

export const STAGE_LABELS = {
  application_submitted: "Application Submitted",
  payment_received: "Payment Received",
  documents_received: "Documents Received",
  identity_verification: "Identity Verification",
  income_verification: "Income Verification",
  credit_report: "Credit Report Check",
  background_check: "Background Report Check",
  criminal_record: "Criminal Record Check",
  rental_history: "Rental History Review",
  manager_final_review: "Manager Final Review",
  decision: "Final Decision",
};

export const SCREENING_LABELS = {
  identity_verification: "Identity Verification",
  income_verification: "Income Verification",
  credit_report: "Credit Report Check",
  background_check: "Background Report Check",
  criminal_record: "Criminal Record Check",
  rental_history: "Eviction / Rental History Check",
  final_review: "Final Review",
};

export const STATUS_BADGE = {
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  pending: "bg-slate-50 text-slate-600 border-slate-200",
  issue_found: "bg-red-50 text-red-700 border-red-200",
  not_required: "bg-slate-50 text-slate-500 border-slate-200",
};

export const DECISION_LABELS = {
  approved: "Approved",
  pre_approved: "Pre-Approved",
  not_qualified: "Not Qualified",
  more_info_needed: "More Information Needed",
  withdrawn: "Withdrawn",
  refunded: "Refunded",
  closed: "Closed",
};
