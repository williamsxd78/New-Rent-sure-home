import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import SiteLayout from "@/components/site/SiteLayout";
import { api, STAGE_LABELS, DECISION_LABELS } from "@/lib/api";
import { Search, CheckCircle2, Clock, AlertTriangle, CircleSlash, Loader2, Mail, MessageSquare } from "lucide-react";

const ICONS = {
  completed: CheckCircle2,
  in_progress: Loader2,
  pending: Clock,
  issue_found: AlertTriangle,
  not_required: CircleSlash,
};
const COLORS = {
  completed: "text-emerald-600 bg-emerald-50 border-emerald-200",
  in_progress: "text-blue-600 bg-blue-50 border-blue-200",
  pending: "text-slate-500 bg-slate-50 border-slate-200",
  issue_found: "text-red-600 bg-red-50 border-red-200",
  not_required: "text-slate-400 bg-slate-50 border-slate-200",
};

export default function TrackingPage() {
  const location = useLocation();
  const [id, setId] = useState(location.state?.id || "");
  const [email, setEmail] = useState("");
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

  return (
    <SiteLayout>
      <section className="bg-[#0A192F] text-white py-14" data-testid="tracking-header">
        <div className="rs-container">
          <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold mb-3">Application Tracking</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold">Track Your Rental Application</h1>
          <p className="text-slate-300 mt-3 max-w-2xl">Enter your Application ID and the email used during application to view your current status.</p>
        </div>
      </section>

      <section className="rs-container py-10">
        <form onSubmit={submit} className="rs-card p-6 lg:p-8 max-w-3xl mx-auto grid sm:grid-cols-2 gap-4" data-testid="tracking-form">
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
              {loading ? "Checking…" : "Track Application"}
            </button>
          </div>
          {error && <div className="sm:col-span-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm" data-testid="track-error">{error}</div>}
        </form>

        {data && <TrackingResult data={data} />}
      </section>
    </SiteLayout>
  );
}

function TrackingResult({ data }) {
  const decision = data.decision;
  const isApproved = decision === "approved" || decision === "pre_approved";
  const isRejected = decision === "not_qualified";
  const isMoreInfo = decision === "more_info_needed";

  return (
    <div className="max-w-4xl mx-auto mt-10 rs-fade-in" data-testid="tracking-result">
      {/* Header card */}
      <div className="relative rs-card p-7 mb-6 overflow-hidden">
        {isRejected && (
          <div className="rs-watermark" data-testid="not-qualified-watermark">
            <div className="rs-watermark-text">NOT QUALIFIED</div>
          </div>
        )}
        <div className="relative z-20 flex flex-wrap justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold">Application</div>
            <div className="font-mono font-bold text-[#0A192F] text-xl mt-1">{data.application_number}</div>
            <div className="font-display text-xl font-semibold text-[#0A192F] mt-3">{data.applicant_name}</div>
            <div className="text-sm text-slate-500">Property: {data.property?.title} · {data.property?.city}, {data.property?.state}</div>
            <div className="text-xs text-slate-400 mt-1">Submitted: {new Date(data.submitted_at).toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 mb-1">Current Decision</div>
            {decision ? (
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${isApproved ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : isRejected ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                {DECISION_LABELS[decision] || decision}
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200">In Review</span>
            )}
          </div>
        </div>
      </div>

      {/* Decision Banners */}
      {isApproved && (
        <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-8 text-center mb-6" data-testid="approved-card">
          <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-3"><CheckCircle2 className="w-7 h-7" /></div>
          <div className="font-display text-3xl font-bold text-emerald-800">Pre-Approved</div>
          <p className="text-emerald-700 mt-2 max-w-xl mx-auto">Your application has passed the initial review. Our manager will contact you for the next steps.</p>
        </div>
      )}
      {isRejected && (
        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-8 mb-6 relative z-20" data-testid="rejected-card">
          <div className="font-display text-xl font-bold text-red-800">Application Not Qualified</div>
          <p className="text-red-700 mt-2 leading-relaxed">Based on the current review, this application does not meet the property's qualification criteria. Please check your email for additional details or contact support.</p>
        </div>
      )}
      {isMoreInfo && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 mb-6" data-testid="more-info-card">
          <div className="font-display text-xl font-bold text-amber-800">Additional Information Required</div>
          <p className="text-amber-700 mt-2 leading-relaxed">{data.applicant_message || "Please check your email or contact support for the list of additional information needed."}</p>
        </div>
      )}

      {/* Timeline */}
      <div className="rs-card p-7">
        <h3 className="font-display text-xl font-semibold text-[#0A192F] mb-6">Status Timeline</h3>
        <div className="space-y-3">
          {(data.timeline || []).map((t) => {
            const Icon = ICONS[t.status] || Clock;
            return (
              <div key={t.key} className={`flex items-center gap-4 p-4 rounded-xl border ${COLORS[t.status] || COLORS.pending}`} data-testid={`timeline-${t.key}`}>
                <Icon className={`w-5 h-5 flex-shrink-0 ${t.status === "in_progress" ? "animate-spin" : ""}`} />
                <div className="flex-1">
                  <div className="font-medium text-[#0A192F]">{STAGE_LABELS[t.key] || t.key}</div>
                  {t.date && <div className="text-xs opacity-75">{new Date(t.date).toLocaleString()}</div>}
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider opacity-75">{(t.status || "pending").replace(/_/g, " ")}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        <div className="rs-card p-5 flex items-center gap-3"><Mail className="w-5 h-5 text-[#C5A880]" /><div><div className="text-xs text-slate-500">Email</div><div className="text-sm text-[#0A192F]">{data.applicant_email}</div></div></div>
        <div className="rs-card p-5 flex items-center gap-3"><MessageSquare className="w-5 h-5 text-[#C5A880]" /><div><div className="text-xs text-slate-500">Messages</div><div className="text-sm text-[#0A192F]">{data.messages?.length || 0} from admin</div></div></div>
      </div>
    </div>
  );
}
