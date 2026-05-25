import React, { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import SiteLayout from "@/components/site/SiteLayout";
import { api, STAGE_LABELS, DECISION_LABELS, formatMoney, downloadConfirmationPdf } from "@/lib/api";
import {
  Search, CheckCircle2, Clock, AlertTriangle, CircleSlash, Loader2, Mail, MessageSquare,
  Info, Download, FileWarning, ShieldCheck, Lock, Phone, FileText, IdCard, Briefcase,
  CreditCard, FileSearch, Scale, Home, UserCheck, Gavel, BadgeCheck, HelpCircle,
  ChevronRight, Sparkles, Camera, ReceiptText,
} from "lucide-react";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------
const STAGE_DESCRIPTIONS = {
  application_submitted: "Your application has been received successfully.",
  payment_received: "Your application/screening fee payment has been received.",
  documents_received: "Your uploaded documents are being reviewed.",
  identity_verification: "Your identity information is being verified.",
  income_verification: "Your income documents are being reviewed.",
  credit_report: "Credit screening is being reviewed where legally permitted.",
  background_check: "Background screening is being reviewed where legally permitted.",
  criminal_record: "Criminal record screening is being reviewed where legally permitted.",
  rental_history: "Rental history and landlord reference may be reviewed.",
  manager_final_review: "A manager is reviewing your full application.",
  decision: "Final application decision will appear here.",
};

const STAGE_ICONS = {
  application_submitted: FileText,
  payment_received: CreditCard,
  documents_received: FileSearch,
  identity_verification: IdCard,
  income_verification: Briefcase,
  credit_report: Scale,
  background_check: ShieldCheck,
  criminal_record: Gavel,
  rental_history: Home,
  manager_final_review: UserCheck,
  decision: BadgeCheck,
};

const STATUS_LABEL = {
  completed: "Completed",
  in_progress: "In Progress",
  pending: "Pending",
  issue_found: "Issue Found",
  not_required: "Not Required",
};

const STATUS_TONE = {
  completed: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    icon: "text-emerald-600 bg-emerald-50 ring-1 ring-emerald-100",
    rail: "bg-emerald-200",
  },
  in_progress: {
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    dot: "bg-sky-500",
    icon: "text-sky-600 bg-sky-50 ring-1 ring-sky-100",
    rail: "bg-sky-200",
  },
  pending: {
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-300",
    icon: "text-slate-400 bg-slate-50 ring-1 ring-slate-100",
    rail: "bg-slate-200",
  },
  issue_found: {
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
    icon: "text-amber-600 bg-amber-50 ring-1 ring-amber-100",
    rail: "bg-amber-200",
  },
  not_required: {
    badge: "bg-slate-50 text-slate-500 border-slate-200",
    dot: "bg-slate-200",
    icon: "text-slate-400 bg-slate-50 ring-1 ring-slate-100",
    rail: "bg-slate-200",
  },
};

const DOC_ICONS = {
  "Government ID": IdCard,
  "Driver License": IdCard,
  "Driver's License": IdCard,
  "Passport": IdCard,
  "State ID": IdCard,
  "Paystub": Briefcase,
  "Pay Stub": Briefcase,
  "W-2": FileText,
  "Tax Document": FileText,
  "Tax Return": FileText,
  "Bank Statement": ReceiptText,
  "Live Selfie": Camera,
  "Selfie Verification": Camera,
  "Live Selfie Verification": Camera,
  "Additional Document": FileText,
  "Additional Documents": FileText,
};

const DOC_STATUS_CONFIG = {
  verified: { label: "Verified", icon: ShieldCheck, cls: "text-emerald-700 bg-emerald-50 border-emerald-200", outline: "border-emerald-200" },
  rejected: { label: "Rejected", icon: AlertTriangle, cls: "text-red-700 bg-red-50 border-red-200", outline: "border-red-200" },
  replacement_requested: { label: "Replacement Needed", icon: FileWarning, cls: "text-amber-700 bg-amber-50 border-amber-200", outline: "border-amber-200" },
  uploaded: { label: "Under Review", icon: Clock, cls: "text-slate-700 bg-slate-50 border-slate-200", outline: "border-slate-200" },
  under_review: { label: "Under Review", icon: Clock, cls: "text-slate-700 bg-slate-50 border-slate-200", outline: "border-slate-200" },
};

const docIconFor = (type) => {
  if (!type) return FileText;
  const base = type.replace(/\s*\d+$/, "").trim();
  return DOC_ICONS[base] || DOC_ICONS[type] || FileText;
};

const fmtDate = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
};

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------
export default function TrackingPage() {
  const location = useLocation();
  const [id, setId] = useState(location.state?.id || "");
  const [email, setEmail] = useState(location.state?.email || "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e?.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await api.post("/track", { application_id: id.trim(), email: email.trim().toLowerCase() });
      setData(r.data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not find application");
      setData(null);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (location.state?.id && location.state?.email && !data && !loading) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SiteLayout>
      {/* Top Header */}
      <section className="bg-gradient-to-br from-[#0A192F] via-[#0E2240] to-[#112240] text-white" data-testid="tracking-header">
        <div className="rs-container py-12 sm:py-14">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#C5A880] font-semibold mb-3">
            <Lock className="w-3.5 h-3.5" /> Secure Application Tracking
          </div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
            Track Your Rental Application
          </h1>
          <p className="text-slate-300 mt-3 max-w-2xl text-sm sm:text-base leading-relaxed">
            Enter your Application ID and the email used during the application to view live status, document review, and decisions.
          </p>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#C5A880]" /> Encrypted tracking link</span>
            <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-[#C5A880]" /> Information is protected</span>
            <span className="inline-flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-[#C5A880]" /> Only authorized management can view documents</span>
          </div>
        </div>
      </section>

      <section className="rs-container py-8 sm:py-10">
        <form onSubmit={submit} className="rs-card p-5 sm:p-7 max-w-3xl mx-auto grid sm:grid-cols-2 gap-4" data-testid="tracking-form">
          <div className="sm:col-span-1">
            <label className="rs-label">Application ID</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="rs-input pl-9 font-mono" value={id} onChange={(e) => setId(e.target.value)} placeholder="APP-XXXXXXXX" data-testid="track-input-id" required />
            </div>
          </div>
          <div>
            <label className="rs-label">Email</label>
            <input type="email" className="rs-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" data-testid="track-input-email" required />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={loading} className="rs-btn-primary" data-testid="track-submit">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking…</> : <>Track Application <ChevronRight className="w-4 h-4" /></>}
            </button>
          </div>
          {error && <div className="sm:col-span-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm" data-testid="track-error">{error}</div>}
        </form>

        {data && <TrackingResult data={data} />}
      </section>
    </SiteLayout>
  );
}

// -----------------------------------------------------------------------------
// Result
// -----------------------------------------------------------------------------
function TrackingResult({ data }) {
  const decision = data.decision;
  const isApproved = decision === "approved" || decision === "pre_approved";
  const isRejected = decision === "not_qualified";
  const isMoreInfo = decision === "more_info_needed";

  const timeline = data.timeline || [];
  const progress = useMemo(() => {
    if (!timeline.length) return 0;
    const total = timeline.length;
    const score = timeline.reduce((s, t) => {
      if (t.status === "completed") return s + 1;
      if (t.status === "in_progress") return s + 0.5;
      return s;
    }, 0);
    return Math.round((score / total) * 100);
  }, [timeline]);

  const overallStatus = useMemo(() => {
    if (isApproved) return { label: "Pre-Approved", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: BadgeCheck };
    if (isRejected) return { label: "Not Qualified", tone: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle };
    if (isMoreInfo) return { label: "More Information Needed", tone: "bg-amber-50 text-amber-800 border-amber-200", icon: Info };
    const anyInProgress = timeline.some((t) => t.status === "in_progress");
    if (anyInProgress) return { label: "Under Review", tone: "bg-sky-50 text-sky-700 border-sky-200", icon: Loader2 };
    return { label: "Application Submitted", tone: "bg-slate-100 text-slate-700 border-slate-200", icon: FileText };
  }, [decision, timeline, isApproved, isRejected, isMoreInfo]);

  return (
    <div className="max-w-5xl mx-auto mt-8 sm:mt-10 rs-fade-in" data-testid="tracking-result">
      <HeroStatusCard data={data} overallStatus={overallStatus} isRejected={isRejected} />

      <ProgressOverview progress={progress} timeline={timeline} />

      {isApproved && <PreApprovedCard data={data} />}
      {isRejected && <NotQualifiedCard data={data} />}
      {isMoreInfo && <MoreInfoCard data={data} />}
      {!decision && <ProcessingNotice />}

      <div className="grid lg:grid-cols-5 gap-6 mt-6">
        <div className="lg:col-span-3 space-y-6">
          <StatusTimeline timeline={timeline} />
          <DocumentReview docs={data.documents || []} />
        </div>
        <aside className="lg:col-span-2 space-y-6">
          <MessageCenter messages={data.messages || []} adminMessage={data.applicant_message} />
          <ContactCard data={data} />
          <ConfirmationReceipt data={data} />
        </aside>
      </div>

      <TrustFooter />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Hero
// -----------------------------------------------------------------------------
function HeroStatusCard({ data, overallStatus, isRejected }) {
  const StatusIcon = overallStatus.icon;
  const payment = data.payment || {};
  const paymentLabel = payment.status === "paid" || payment.status === "completed"
    ? "Paid"
    : payment.status === "pending" ? "Pending" : (payment.status || "Pending");
  const paymentTone = payment.status === "paid" || payment.status === "completed"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-amber-50 text-amber-800 border-amber-200";

  return (
    <div className="relative rs-card overflow-hidden" data-testid="hero-status-card">
      {isRejected && (
        <div className="rs-watermark" data-testid="not-qualified-watermark">
          <div className="rs-watermark-text">NOT QUALIFIED</div>
        </div>
      )}
      <div className="relative z-20 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[#C5A880] font-semibold">Applicant</div>
            <div className="font-display text-2xl sm:text-3xl font-semibold text-[#0A192F] mt-1 truncate">{data.applicant_name}</div>
            <div className="text-sm text-slate-600 mt-1">
              {data.property?.title}
              {data.property?.city && <> · {data.property.city}, {data.property.state}</>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold border ${overallStatus.tone}`} data-testid="overall-status-badge">
              <StatusIcon className={`w-3.5 h-3.5 ${overallStatus.label === "Under Review" ? "animate-spin" : ""}`} />
              {overallStatus.label}
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border ${paymentTone}`} data-testid="payment-status-badge">
              <CreditCard className="w-3 h-3" /> Payment {paymentLabel}
            </span>
          </div>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <MetaCell label="Application ID" value={<span className="font-mono font-semibold text-[#0A192F]">{data.application_number}</span>} />
          <MetaCell label="Submitted" value={fmtDate(data.submitted_at) || "—"} />
          <MetaCell label="Application Fee" value={payment.amount ? formatMoney(payment.amount) : "—"} />
          <MetaCell label="Estimated Review" value="24–48 hours" />
        </div>

        {data.applicant_message && (
          <div className="mt-6 p-4 rounded-xl border border-slate-200 bg-slate-50/70" data-testid="manager-message">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Message from Management</div>
            <div className="text-sm text-[#0A192F] leading-relaxed whitespace-pre-line">{data.applicant_message}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetaCell({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-sm text-[#0A192F] mt-1">{value}</div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Progress
// -----------------------------------------------------------------------------
function ProgressOverview({ progress, timeline }) {
  const completed = timeline.filter((t) => t.status === "completed").length;
  return (
    <div className="rs-card p-5 sm:p-6 mt-6" data-testid="progress-overview">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#C5A880]" />
          <div className="font-display font-semibold text-[#0A192F]">Application Progress</div>
        </div>
        <div className="text-sm text-slate-600">
          <span className="font-semibold text-[#0A192F]" data-testid="progress-percent">{progress}%</span> Complete
          <span className="text-slate-400 ml-2 text-xs">({completed}/{timeline.length} steps)</span>
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#0A192F] via-[#1c3460] to-[#C5A880] transition-all duration-700"
          style={{ width: `${Math.max(progress, 2)}%` }}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Decision banners
// -----------------------------------------------------------------------------
function ProcessingNotice() {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5 mt-6 flex items-start gap-3" data-testid="processing-notice">
      <Info className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-sky-900 leading-relaxed">
        <div className="font-semibold">Your application is currently under review.</div>
        <div className="mt-1">Our team is verifying your documents and screening information. Most reviews are completed within <strong>24–48 hours</strong> of payment. We'll email you the moment your status changes.</div>
      </div>
    </div>
  );
}

function PreApprovedCard({ data }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/60 p-7 sm:p-8 text-center mt-6" data-testid="approved-card">
      <div className="absolute top-3 right-3 sm:top-4 sm:right-5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold tracking-wider uppercase">
        <BadgeCheck className="w-3.5 h-3.5" /> Pre-Approved
      </div>
      <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200">
        <CheckCircle2 className="w-9 h-9" />
      </div>
      <div className="font-display text-3xl sm:text-4xl font-bold text-emerald-900">Pre-Approved</div>
      <p className="text-emerald-800/90 mt-3 max-w-xl mx-auto leading-relaxed">
        Your application has passed the initial review. Our management team will contact you with the next steps.
      </p>
      <a href={`mailto:${data.applicant_email}`} className="inline-flex items-center gap-2 mt-5 px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors" data-testid="view-next-steps-btn">
        View Next Steps <ChevronRight className="w-4 h-4" />
      </a>
    </div>
  );
}

function NotQualifiedCard({ data }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/70 p-6 sm:p-7 mt-6 relative z-20" data-testid="rejected-card">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-full bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="font-display text-xl font-bold text-red-900">After review, this application does not currently meet the qualification requirements for this property.</div>
          <p className="text-red-800/90 mt-2 leading-relaxed text-sm">
            You may contact support if you believe information was submitted incorrectly or if you would like to provide additional documents.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/contact" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0A192F] text-white font-medium hover:bg-[#112240] transition-colors text-sm" data-testid="contact-support-btn">
              <MessageSquare className="w-4 h-4" /> Contact Support
            </Link>
            <a href={`mailto:support@rentsurehomes.com?subject=Application%20${encodeURIComponent(data.application_number)}`} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-red-300 text-red-900 hover:bg-red-100/50 font-medium text-sm">
              <Mail className="w-4 h-4" /> Email Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoreInfoCard({ data }) {
  const flagged = (data.documents || []).filter((d) => d.status === "rejected" || d.status === "replacement_requested");
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-7 mt-6" data-testid="more-info-card">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
          <Info className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="font-display text-xl font-bold text-amber-900">Additional Information Required</div>
          <p className="text-amber-900/90 mt-2 leading-relaxed text-sm">
            {data.applicant_message || "Please review the documents flagged below and email replacement files to our support team."}
          </p>
          {flagged.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm text-amber-900">
              {flagged.map((d, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span><strong>{d.type}</strong>{d.review_reason ? <> — <span className="opacity-90">{d.review_reason}</span></> : null}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <a href={`mailto:support@rentsurehomes.com?subject=Additional%20Docs%20for%20${encodeURIComponent(data.application_number)}`} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors text-sm" data-testid="upload-missing-btn">
              <Mail className="w-4 h-4" /> Submit Missing Documents
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Timeline
// -----------------------------------------------------------------------------
function StatusTimeline({ timeline }) {
  if (!timeline.length) return null;
  return (
    <div className="rs-card p-5 sm:p-7" data-testid="status-timeline">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-lg sm:text-xl font-semibold text-[#0A192F]">Status Timeline</h3>
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-[#C5A880]" /> Updates in real time
        </span>
      </div>
      <ol className="relative">
        {timeline.map((t, idx) => {
          const tone = STATUS_TONE[t.status] || STATUS_TONE.pending;
          const Icon = STAGE_ICONS[t.key] || Clock;
          const isLast = idx === timeline.length - 1;
          const nextTone = !isLast ? (STATUS_TONE[timeline[idx + 1]?.status] || STATUS_TONE.pending) : null;
          return (
            <li key={t.key} className="relative flex gap-4 pb-5 last:pb-0" data-testid={`timeline-${t.key}`}>
              {!isLast && (
                <span aria-hidden className={`absolute left-[18px] top-9 bottom-0 w-px ${nextTone?.rail || "bg-slate-200"}`} />
              )}
              <div className={`relative z-10 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${tone.icon}`}>
                <Icon className={`w-4 h-4 ${t.status === "in_progress" ? "animate-spin" : ""}`} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#0A192F] text-sm sm:text-base">{STAGE_LABELS[t.key] || t.key}</div>
                  <div className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-relaxed">{STAGE_DESCRIPTIONS[t.key] || ""}</div>
                  {t.note && <div className="text-xs text-slate-500 italic mt-1">Note: {t.note}</div>}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border whitespace-nowrap ${tone.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                    {STATUS_LABEL[t.status] || "Pending"}
                  </span>
                  {t.date && <div className="text-[11px] text-slate-400 whitespace-nowrap">{fmtDate(t.date)}</div>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Documents (deduped + numbered)
// -----------------------------------------------------------------------------
function DocumentReview({ docs }) {
  // Group duplicates by type and number them (Paystub 1, Paystub 2)
  const items = useMemo(() => {
    const grouped = new Map();
    docs.forEach((d) => {
      const key = (d.type || "Document").trim();
      const arr = grouped.get(key) || [];
      arr.push(d);
      grouped.set(key, arr);
    });
    const out = [];
    grouped.forEach((arr, key) => {
      arr.forEach((d, i) => {
        const label = arr.length > 1 ? `${key} ${i + 1}` : key;
        out.push({ ...d, label });
      });
    });
    return out;
  }, [docs]);

  const flagged = items.filter((d) => d.status === "rejected" || d.status === "replacement_requested");

  return (
    <div className="rs-card p-5 sm:p-7" data-testid="doc-status-list">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-display text-lg sm:text-xl font-semibold text-[#0A192F]">Document Review</h3>
        <span className="text-xs text-slate-500">{items.length} document{items.length === 1 ? "" : "s"} on file</span>
      </div>

      {flagged.length > 0 && (
        <div className="mb-4 p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-start gap-3" data-testid="docs-attention-notice">
          <FileWarning className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-amber-900">{flagged.length} document{flagged.length > 1 ? "s need" : " needs"} your attention</div>
            <div className="text-amber-800 mt-0.5">Please review the reasons below and email us replacement file(s).</div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="p-5 rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 text-center">
          No documents uploaded yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((d, i) => {
            const cfg = DOC_STATUS_CONFIG[d.status] || DOC_STATUS_CONFIG.uploaded;
            const Icon = cfg.icon;
            const DocIcon = docIconFor(d.type);
            return (
              <div key={i} className={`rounded-xl border ${cfg.outline} p-4 bg-white hover:shadow-sm transition-shadow`} data-testid={`tracking-doc-${i}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.cls}`}>
                    <DocIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[#0A192F] text-sm">{d.label}</div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border whitespace-nowrap ${cfg.cls}`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </span>
                      {d.uploaded_at && (
                        <span className="text-[11px] text-slate-400">Updated {fmtDate(d.uploaded_at)}</span>
                      )}
                    </div>
                    {d.review_reason && (d.status === "rejected" || d.status === "replacement_requested") && (
                      <div className="text-xs text-slate-700 mt-2 p-2 rounded-md bg-slate-50 border border-slate-200">
                        <strong className="text-slate-900">Reason:</strong> {d.review_reason}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sidebar cards
// -----------------------------------------------------------------------------
function MessageCenter({ messages, adminMessage }) {
  const count = (messages || []).length + (adminMessage ? 1 : 0);
  const latest = adminMessage || (messages && messages.length > 0 ? (messages[messages.length - 1]?.message || messages[messages.length - 1]?.text) : "");

  return (
    <div className="rs-card p-5 sm:p-6" data-testid="message-center">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#C5A880]" />
          <div className="font-display font-semibold text-[#0A192F]">Messages</div>
        </div>
        {count > 0 && (
          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#0A192F] text-white text-[10px] font-bold">
            {count}
          </span>
        )}
      </div>
      {count === 0 ? (
        <div className="text-sm text-slate-500 leading-relaxed">No messages from management at this time.</div>
      ) : (
        <>
          <div className="text-sm text-[#0A192F] leading-relaxed line-clamp-4 whitespace-pre-line">{latest}</div>
          <a href="mailto:support@rentsurehomes.com" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#0A192F] hover:text-[#C5A880] transition-colors">
            View Messages <ChevronRight className="w-4 h-4" />
          </a>
        </>
      )}
    </div>
  );
}

function ContactCard({ data }) {
  return (
    <div className="rs-card p-5 sm:p-6" data-testid="contact-card">
      <div className="flex items-center gap-2 mb-3">
        <UserCheck className="w-4 h-4 text-[#C5A880]" />
        <div className="font-display font-semibold text-[#0A192F]">Applicant Contact</div>
      </div>
      <div className="space-y-2.5">
        {data.applicant_email && (
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-[#0A192F] truncate">{data.applicant_email}</span>
          </div>
        )}
        {data.applicant_phone && (
          <div className="flex items-center gap-3 text-sm">
            <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-[#0A192F]">{data.applicant_phone}</span>
          </div>
        )}
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
        Sensitive information (SSN, IDs, documents) is never displayed on this page.
      </div>
    </div>
  );
}

function ConfirmationReceipt({ data }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const handle = async () => {
    setErr("");
    setBusy(true);
    try {
      await downloadConfirmationPdf(data.application_number, data.applicant_email);
    } catch (e) {
      setErr(e?.response?.status === 403 ? "Email mismatch — cannot download" : "Could not download PDF. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="rs-card p-5 sm:p-6" data-testid="tracking-download-card">
      <div className="flex items-center gap-2 mb-3">
        <ReceiptText className="w-4 h-4 text-[#C5A880]" />
        <div className="font-display font-semibold text-[#0A192F]">Confirmation & Receipt</div>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">
        Download a PDF of your application summary and payment receipt for your records.
      </p>
      <button onClick={handle} disabled={busy} className="mt-4 w-full rs-btn-outline justify-center" data-testid="tracking-download-btn">
        <Download className="w-4 h-4" /> {busy ? "Preparing PDF…" : "Download Confirmation PDF"}
      </button>
      {err && <div className="text-xs text-red-600 mt-2" data-testid="tracking-download-error">{err}</div>}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <Link to="/policies/refund" className="text-xs text-slate-500 hover:text-[#0A192F] inline-flex items-center gap-1">
          <HelpCircle className="w-3 h-3" /> Refund Policy
        </Link>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Trust Footer
// -----------------------------------------------------------------------------
function TrustFooter() {
  return (
    <div className="mt-8 mb-2 p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3" data-testid="trust-footer">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-[#C5A880]" /> Secure tracking link</span>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#C5A880]" /> Application information is protected</span>
        <span className="inline-flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-[#C5A880]" /> Authorized management only</span>
      </div>
      <Link to="/contact" className="text-xs font-medium text-[#0A192F] hover:text-[#C5A880] inline-flex items-center gap-1">
        Need help? <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
