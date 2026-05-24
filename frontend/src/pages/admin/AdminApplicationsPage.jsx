import React, { useEffect, useState } from "react";
import { api, formatMoney, SCREENING_LABELS, DECISION_LABELS, STATUS_BADGE } from "@/lib/api";
import { Search, Eye, FileText, CheckCircle2, AlertTriangle, MessageSquare, X } from "lucide-react";

const SCREENING_KEYS = ["identity_verification", "income_verification", "credit_report", "background_check", "criminal_record", "rental_history", "final_review"];

const STATUSES = ["pending", "in_progress", "completed", "issue_found", "not_required"];

export default function AdminApplicationsPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);

  const load = async () => {
    const r = await api.get("/admin/applications", { params: q ? { q } : {} });
    setItems(r.data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const openApp = async (id) => {
    const r = await api.get(`/admin/applications/${id}`);
    setSelected(r.data);
  };

  const updateScreening = async (key, status, notes = "") => {
    await api.post(`/admin/applications/${selected.id}/screening`, { key, status, notes });
    openApp(selected.id);
  };

  const setDecision = async (decision, note = "", applicant_message = "") => {
    await api.post(`/admin/applications/${selected.id}/decision`, { decision, note, applicant_message });
    openApp(selected.id);
    load();
  };

  const markPayment = async (status) => {
    const fd = new FormData(); fd.append("status", status);
    await api.post(`/admin/applications/${selected.id}/payment/mark`, fd);
    openApp(selected.id);
  };

  return (
    <div className="p-6 lg:p-10" data-testid="admin-applications">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <h1 className="font-display text-3xl font-bold text-[#0A192F]">Applications</h1>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="rs-input pl-9 !py-2" placeholder="Search by name, email, ID" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} data-testid="search-applications" />
          </div>
          <button onClick={load} className="rs-btn-primary !py-2">Search</button>
        </div>
      </div>

      <div className="rs-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 text-left">
            <tr><th className="p-4">App ID</th><th className="p-4">Applicant</th><th className="p-4">Property</th><th className="p-4">Payment</th><th className="p-4">Decision</th><th className="p-4">Submitted</th><th className="p-4 text-right">Action</th></tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`row-app-${a.id}`}>
                <td className="p-4 font-mono text-xs">{a.application_number}</td>
                <td className="p-4">
                  <div className="font-medium text-[#0A192F]">{a.applicant_name}</div>
                  <div className="text-xs text-slate-500">{a.applicant_email}</div>
                </td>
                <td className="p-4 text-slate-600">{a.property_title}<br /><span className="text-xs text-slate-400">{a.property_city}</span></td>
                <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-xs ${a.payment?.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{a.payment?.status || "pending"}</span></td>
                <td className="p-4">{a.decision ? <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">{DECISION_LABELS[a.decision] || a.decision}</span> : <span className="text-xs text-slate-400">In Review</span>}</td>
                <td className="p-4 text-xs text-slate-500">{a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : "—"}</td>
                <td className="p-4 text-right"><button onClick={() => openApp(a.id)} className="text-[#0A192F] hover:text-[#C5A880]" data-testid={`view-app-${a.id}`}><Eye className="w-4 h-4 inline" /></button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-slate-400">No applications found.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <ApplicationDetailModal app={selected} onClose={() => setSelected(null)} updateScreening={updateScreening} setDecision={setDecision} markPayment={markPayment} />
      )}
    </div>
  );
}

function ApplicationDetailModal({ app, onClose, updateScreening, setDecision, markPayment }) {
  const [tab, setTab] = useState("overview");
  const [decisionDraft, setDecisionDraft] = useState({ decision: app.decision || "", note: app.decision_note || "", applicant_message: app.applicant_message || "" });

  return (
    <div className="fixed inset-0 z-50 bg-[#0A192F]/60 flex items-center justify-center p-4" data-testid="app-detail-modal">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="font-mono text-xs text-slate-500">{app.application_number}</div>
            <h2 className="font-display text-xl font-bold text-[#0A192F]">{app.applicant_name}</h2>
            <div className="text-sm text-slate-500">{app.applicant_email} · {app.applicant_phone}</div>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="border-b border-slate-100 px-6 flex gap-1 overflow-x-auto">
          {["overview", "screening", "documents", "payment", "decision", "messages"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium capitalize border-b-2 transition ${tab === t ? "border-[#C5A880] text-[#0A192F]" : "border-transparent text-slate-500 hover:text-[#0A192F]"}`} data-testid={`tab-${t}`}>{t}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "overview" && (
            <div className="grid sm:grid-cols-2 gap-5">
              <DataBlock title="Personal" data={app.personal} />
              <DataBlock title="Contact" data={app.contact} />
              <DataBlock title="Employment" data={app.employment} />
              <DataBlock title="Rental History" data={app.rental_history} />
              <DataBlock title="Occupants & Pets" data={app.occupants} />
              <DataBlock title="Consent" data={app.consent} />
              <div className="sm:col-span-2 rs-card p-5">
                <div className="font-display font-semibold text-[#0A192F]">SSN</div>
                <div className="text-sm text-slate-600 mt-2">Last 4: <span className="font-mono">***-**-{app.ssn_last4 || "----"}</span></div>
                {app.ssn_full_doc_path && <div className="text-sm text-slate-600 mt-1">Full SSN Document: <span className="font-mono text-slate-400">[REDACTED — Super Admin only]</span></div>}
              </div>
            </div>
          )}

          {tab === "screening" && (
            <div className="space-y-3">
              {SCREENING_KEYS.map((k) => {
                const s = app.screening?.[k] || { status: "pending", notes: "" };
                return (
                  <div key={k} className="rs-card p-5" data-testid={`screening-${k}`}>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="font-medium text-[#0A192F]">{SCREENING_LABELS[k]}</div>
                      <select className="rs-input !py-2 !w-auto" value={s.status} onChange={(e) => updateScreening(k, e.target.value, s.notes)} data-testid={`screening-status-${k}`}>
                        {STATUSES.map((st) => <option key={st} value={st}>{st.replace(/_/g, " ")}</option>)}
                      </select>
                    </div>
                    <input className="rs-input mt-3 text-sm" placeholder="Add notes…" defaultValue={s.notes} onBlur={(e) => e.target.value !== s.notes && updateScreening(k, s.status, e.target.value)} />
                  </div>
                );
              })}
            </div>
          )}

          {tab === "documents" && (
            <div className="space-y-3">
              {(app.documents || []).length === 0 ? <div className="text-slate-400 text-sm">No documents uploaded.</div> : app.documents.map((d, i) => (
                <div key={i} className="rs-card p-5 flex items-center gap-4">
                  <FileText className="w-8 h-8 text-[#C5A880]" />
                  <div className="flex-1">
                    <div className="font-medium text-[#0A192F]">{d.type}</div>
                    <div className="text-xs text-slate-500">{d.filename} · {d.size ? `${Math.round(d.size / 1024)} KB` : ""}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700">{d.status}</span>
                </div>
              ))}
            </div>
          )}

          {tab === "payment" && (
            <div className="space-y-4">
              <div className="rs-card p-5">
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <div><div className="text-slate-500">Status</div><div className="font-medium text-[#0A192F]">{app.payment?.status}</div></div>
                  <div><div className="text-slate-500">Amount</div><div className="font-medium text-[#0A192F]">{formatMoney(app.payment?.amount || 0)}</div></div>
                  <div><div className="text-slate-500">Method</div><div className="font-medium text-[#0A192F]">{app.payment?.method || "—"}</div></div>
                  <div className="sm:col-span-3"><div className="text-slate-500">Transaction ID</div><div className="font-mono text-xs text-[#0A192F]">{app.payment?.transaction_id || "—"}</div></div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {["paid", "refunded", "failed", "pending"].map((s) => (
                  <button key={s} onClick={() => markPayment(s)} className="rs-btn-outline !py-2 !px-4 text-sm capitalize" data-testid={`mark-payment-${s}`}>Mark {s}</button>
                ))}
              </div>
            </div>
          )}

          {tab === "decision" && (
            <div className="space-y-5">
              <div className="rs-card p-5">
                <label className="rs-label">Decision</label>
                <select className="rs-input" value={decisionDraft.decision} onChange={(e) => setDecisionDraft({ ...decisionDraft, decision: e.target.value })} data-testid="decision-select">
                  <option value="">-- Select --</option>
                  {Object.entries(DECISION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <label className="rs-label mt-4">Internal Note</label>
                <textarea className="rs-input" rows={3} value={decisionDraft.note} onChange={(e) => setDecisionDraft({ ...decisionDraft, note: e.target.value })} data-testid="decision-note" />
                <label className="rs-label mt-4">Message to Applicant (shown on tracking page)</label>
                <textarea className="rs-input" rows={3} value={decisionDraft.applicant_message} onChange={(e) => setDecisionDraft({ ...decisionDraft, applicant_message: e.target.value })} data-testid="decision-msg" />
                <button onClick={() => setDecision(decisionDraft.decision, decisionDraft.note, decisionDraft.applicant_message)} disabled={!decisionDraft.decision} className="rs-btn-primary mt-5 disabled:opacity-40" data-testid="save-decision">Save Decision</button>
              </div>
              {decisionDraft.decision === "not_qualified" && (
                <div className="rs-card p-5 bg-red-50/30 border-red-100">
                  <div className="flex items-center gap-2 text-red-700 font-display font-semibold"><AlertTriangle className="w-5 h-5" /> Adverse Action Notice</div>
                  <p className="text-sm text-slate-600 mt-2">Template ready — review and edit before sending. Auto-send is disabled.</p>
                  <button className="rs-btn-outline mt-3 !py-2 !px-4 text-sm">Generate Adverse Action Notice</button>
                </div>
              )}
            </div>
          )}

          {tab === "messages" && (
            <div className="space-y-3">
              {(app.messages || []).length === 0 ? <div className="text-slate-400 text-sm">No messages yet.</div> : app.messages.map((m) => (
                <div key={m.id} className="rs-card p-4">
                  <div className="text-xs text-slate-400">{m.sender} · {new Date(m.created_at).toLocaleString()}</div>
                  <div className="text-sm text-[#0A192F] mt-1">{m.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const DataBlock = ({ title, data }) => (
  <div className="rs-card p-5">
    <div className="font-display font-semibold text-[#0A192F] mb-3">{title}</div>
    <div className="space-y-1.5 text-sm">
      {Object.entries(data || {}).map(([k, v]) => (
        <div key={k}><span className="text-slate-400 capitalize">{k.replace(/_/g, " ")}: </span><span className="text-[#0A192F]">{typeof v === "boolean" ? (v ? "Yes" : "No") : String(v || "—")}</span></div>
      ))}
    </div>
  </div>
);
