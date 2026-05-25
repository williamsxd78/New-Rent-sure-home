import React, { useEffect, useMemo, useState } from "react";
import { api, formatMoney, BACKEND_URL, SCREENING_LABELS, DECISION_LABELS, STATUS_BADGE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Search, Eye, FileText, CheckCircle2, AlertTriangle, MessageSquare, X, Lock, Download, ImageIcon, FileDown, RefreshCw, XCircle, ShieldCheck, Trash2 } from "lucide-react";

const SCREENING_KEYS = ["identity_verification", "income_verification", "credit_report", "background_check", "criminal_record", "rental_history", "final_review"];

// Timeline stages that don't have a `screening` counterpart — admin manages
// these directly from the Screening tab via /admin/applications/:id/timeline.
const EXTRA_TIMELINE_STAGES = [
  { key: "documents_received", label: "Documents Received" },
  { key: "manager_final_review", label: "Manager Final Review" },
];

const STATUSES = ["pending", "in_progress", "completed", "issue_found", "not_required"];

const SSN_REASONS = [
  "Screening verification",
  "Identity verification",
  "Compliance review",
  "Applicant support",
];

export default function AdminApplicationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [bulkErr, setBulkErr] = useState("");
  const [bulkMsg, setBulkMsg] = useState("");

  const isSuperAdmin = user?.role === "super_admin";

  const load = async () => {
    const r = await api.get("/admin/applications", { params: q ? { q } : {} });
    setItems(r.data);
    setSelectedIds(new Set());
  };

  const [exporting, setExporting] = useState(false);
  const exportCsv = async (idsOverride) => {
    setExporting(true);
    try {
      const params = idsOverride && idsOverride.length
        ? { ids: idsOverride.join(",") }
        : (q ? { q } : {});
      const r = await api.get("/admin/applications/export.csv", { params, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([r.data], { type: "text/csv" }));
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url; a.download = `rentsure-applications-${ts}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } finally { setExporting(false); }
  };

  const toggleOne = (id) => {
    setSelectedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    setSelectedIds((s) => s.size === items.length ? new Set() : new Set(items.map((a) => a.id)));
  };
  const allSelected = useMemo(() => items.length > 0 && selectedIds.size === items.length, [items, selectedIds]);
  const someSelected = selectedIds.size > 0 && !allSelected;

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!isSuperAdmin) {
      setBulkErr("Only super admins can delete applications.");
      return;
    }
    const n = selectedIds.size;
    if (!window.confirm(`Permanently delete ${n} application${n === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setDeleting(true); setBulkErr(""); setBulkMsg("");
    try {
      const r = await api.post("/admin/applications/bulk-delete", { ids: Array.from(selectedIds) });
      setBulkMsg(`Deleted ${r.data.deleted} application${r.data.deleted === 1 ? "" : "s"}.`);
      setTimeout(() => setBulkMsg(""), 4000);
      await load();
    } catch (e) {
      setBulkErr(e?.response?.data?.detail || "Bulk delete failed");
    } finally { setDeleting(false); }
  };

  const bulkDownload = async () => {
    if (selectedIds.size === 0) return;
    await exportCsv(Array.from(selectedIds));
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

  const updateTimelineStage = async (key, status, note = "") => {
    await api.post(`/admin/applications/${selected.id}/timeline`, { key, status, note });
    openApp(selected.id);
  };

  const setDecision = async (decision, note = "", applicant_message = "") => {
    await api.post(`/admin/applications/${selected.id}/decision`, { decision, note, applicant_message });
    openApp(selected.id);
    load();
  };

  const reviewDocument = async (idx, status, reason = "") => {
    await api.patch(`/admin/applications/${selected.id}/documents/${idx}`, { status, reason });
    openApp(selected.id);
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
          <button onClick={exportCsv} disabled={exporting || items.length === 0} className="rs-btn-outline !py-2 disabled:opacity-50" data-testid="export-csv-btn" title="Export current view to CSV">
            <FileDown className="w-4 h-4" /> {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      {(bulkMsg || bulkErr) && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${bulkErr ? "bg-red-50 border border-red-200 text-red-700" : "bg-emerald-50 border border-emerald-200 text-emerald-700"}`} data-testid="bulk-feedback">
          {bulkErr || bulkMsg}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap p-3 rounded-lg bg-[#0A192F] text-white" data-testid="bulk-actions-bar">
          <div className="text-sm">
            <span className="font-semibold" data-testid="bulk-selected-count">{selectedIds.size}</span> application{selectedIds.size === 1 ? "" : "s"} selected
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={bulkDownload} disabled={exporting} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-sm font-medium disabled:opacity-50" data-testid="bulk-download-btn">
              <FileDown className="w-4 h-4" /> {exporting ? "Preparing…" : "Download Selected"}
            </button>
            <button
              onClick={bulkDelete}
              disabled={deleting || !isSuperAdmin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-sm font-medium disabled:opacity-50"
              title={!isSuperAdmin ? "Super admin only" : ""}
              data-testid="bulk-delete-btn"
            >
              <Trash2 className="w-4 h-4" /> {deleting ? "Deleting…" : "Delete Selected"}
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="inline-flex items-center px-3 py-1.5 rounded-md hover:bg-white/10 text-sm" data-testid="bulk-clear">
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="rs-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[960px]">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 text-left">
            <tr>
              <th className="p-4 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll}
                  className="w-4 h-4 accent-[#0A192F] cursor-pointer"
                  aria-label="Select all"
                  data-testid="bulk-select-all"
                />
              </th>
              <th className="p-4">App ID</th><th className="p-4">Applicant</th><th className="p-4">Property</th><th className="p-4">Payment</th><th className="p-4">Decision</th><th className="p-4">Submitted</th><th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => {
              const checked = selectedIds.has(a.id);
              return (
                <tr key={a.id} className={`border-t border-slate-100 hover:bg-slate-50 ${checked ? "bg-[#0A192F]/5" : ""}`} data-testid={`row-app-${a.id}`}>
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(a.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 accent-[#0A192F] cursor-pointer"
                      aria-label={`Select ${a.application_number}`}
                      data-testid={`select-app-${a.id}`}
                    />
                  </td>
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
              );
            })}
            {items.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-slate-400">No applications found.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <ApplicationDetailModal app={selected} onClose={() => setSelected(null)} updateScreening={updateScreening} updateTimelineStage={updateTimelineStage} setDecision={setDecision} markPayment={markPayment} reviewDocument={reviewDocument} />
      )}
    </div>
  );
}

function ApplicationDetailModal({ app, onClose, updateScreening, updateTimelineStage, setDecision, markPayment, reviewDocument }) {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [decisionDraft, setDecisionDraft] = useState({ decision: app.decision || "", note: app.decision_note || "", applicant_message: app.applicant_message || "" });
  const [reasonModal, setReasonModal] = useState(null); // { kind: 'ssn' | 'doc', idx?: number }
  const [reasonDraft, setReasonDraft] = useState({ reason: SSN_REASONS[0], custom: "" });
  const [viewerError, setViewerError] = useState("");

  const isSuperAdmin = user?.role === "super_admin";

  const openWithToken = async (url) => {
    setViewerError("");
    try {
      const r = await api.get(url, { responseType: "blob" });
      const blobUrl = URL.createObjectURL(r.data);
      window.open(blobUrl, "_blank");
      // Revoke after 60s to free memory
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (e) {
      setViewerError(e?.response?.data?.detail || "Could not open document");
    }
  };

  const viewDocument = async (idx, sensitive) => {
    if (sensitive) {
      setReasonModal({ kind: "doc", idx });
      return;
    }
    await openWithToken(`/admin/applications/${app.id}/documents/${idx}/file`);
  };

  const confirmReason = async () => {
    const reason = (reasonDraft.custom || reasonDraft.reason || "").trim();
    if (!reason) return;
    const m = reasonModal;
    setReasonModal(null);
    if (m.kind === "ssn") {
      await openWithToken(`/admin/applications/${app.id}/ssn-doc/file?reason=${encodeURIComponent(reason)}`);
    } else if (m.kind === "doc") {
      await openWithToken(`/admin/applications/${app.id}/documents/${m.idx}/file?reason=${encodeURIComponent(reason)}`);
    }
  };

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
                <div className="font-display font-semibold text-[#0A192F] flex items-center gap-2"><Lock className="w-4 h-4 text-[#C5A880]" /> SSN</div>
                <div className="text-sm text-slate-600 mt-2">Last 4: <span className="font-mono">***-**-{app.ssn_last4 || "----"}</span></div>
                {app.ssn_full_doc_path && (
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-slate-600">Full SSN Document:</span>
                    {isSuperAdmin ? (
                      <button
                        onClick={() => { setReasonDraft({ reason: SSN_REASONS[0], custom: "" }); setReasonModal({ kind: "ssn" }); }}
                        className="rs-btn-gold !py-1.5 !px-3 text-xs"
                        data-testid="reveal-ssn-btn"
                      >
                        <Eye className="w-3.5 h-3.5" /> Reveal (audit-logged)
                      </button>
                    ) : (
                      <span className="font-mono text-xs text-slate-400">[REDACTED — Super Admin only]</span>
                    )}
                  </div>
                )}
                {viewerError && <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{viewerError}</div>}
              </div>
            </div>
          )}

          {tab === "screening" && (
            <div className="space-y-3">
              {EXTRA_TIMELINE_STAGES.map(({ key, label }) => {
                const tl = (app.timeline || []).find((t) => t.key === key) || { status: "pending", note: "" };
                return (
                  <div key={key} className="rs-card p-5 border-l-4 border-l-[#C5A880]" data-testid={`timeline-${key}`}>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <div className="font-medium text-[#0A192F]">{label}</div>
                        <div className="text-[11px] text-slate-400">Manual timeline stage</div>
                      </div>
                      <select className="rs-input !py-2 !w-auto" value={tl.status} onChange={(e) => updateTimelineStage(key, e.target.value, tl.note || "")} data-testid={`timeline-status-${key}`}>
                        {STATUSES.map((st) => <option key={st} value={st}>{st.replace(/_/g, " ")}</option>)}
                      </select>
                    </div>
                    <input className="rs-input mt-3 text-sm" placeholder="Add note (optional)…" defaultValue={tl.note || ""} onBlur={(e) => e.target.value !== (tl.note || "") && updateTimelineStage(key, tl.status, e.target.value)} />
                  </div>
                );
              })}
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
                <DocumentRow
                  key={i}
                  d={d}
                  idx={i}
                  onView={() => viewDocument(i, d.is_sensitive)}
                  onReview={reviewDocument}
                />
              ))}
              {viewerError && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{viewerError}</div>}
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

      {reasonModal && (
        <div className="fixed inset-0 z-[70] bg-[#0A192F]/70 flex items-center justify-center p-4" data-testid="reason-modal">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-5 h-5 text-[#C5A880]" />
              <h3 className="font-display text-lg font-semibold text-[#0A192F]">Reason for access</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              This document contains highly sensitive personal information. Unauthorized access, download, sharing, or storage is prohibited. Your access will be logged.
            </p>
            <label className="rs-label">Select a reason</label>
            <select className="rs-input" value={reasonDraft.reason} onChange={(e) => setReasonDraft({ ...reasonDraft, reason: e.target.value })} data-testid="reason-select">
              {SSN_REASONS.map((r) => <option key={r}>{r}</option>)}
              <option value="__custom">Other (specify)…</option>
            </select>
            {reasonDraft.reason === "__custom" && (
              <input className="rs-input mt-3" placeholder="Type a reason" value={reasonDraft.custom} onChange={(e) => setReasonDraft({ ...reasonDraft, custom: e.target.value })} data-testid="reason-custom" />
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setReasonModal(null)} className="rs-btn-outline">Cancel</button>
              <button onClick={confirmReason} className="rs-btn-primary" data-testid="reason-confirm">View Document</button>
            </div>
          </div>
        </div>
      )}
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


const DOC_STATUS_STYLE = {
  uploaded: { label: "Uploaded", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  verified: { label: "Verified", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-700 border-red-200" },
  replacement_requested: { label: "Replacement Requested", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

function DocumentRow({ d, idx, onView, onReview }) {
  const isImage = (d.content_type || "").startsWith("image/") || /\.(jpe?g|png)$/i.test(d.filename || "");
  const Icon = isImage ? ImageIcon : FileText;
  const status = DOC_STATUS_STYLE[d.status] || DOC_STATUS_STYLE.uploaded;
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(null); // 'reject' | 'replace'
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  const act = async (action) => {
    setErr("");
    if (action === "verify") {
      setBusy(true);
      try { await onReview(idx, "verified", ""); } catch (e) { setErr(e?.response?.data?.detail || "Failed"); } finally { setBusy(false); }
      return;
    }
    setPrompt(action);
    setReason(d.review_reason || "");
  };

  const submitPrompt = async () => {
    if (!reason.trim()) { setErr("A reason is required"); return; }
    setBusy(true);
    setErr("");
    try {
      await onReview(idx, prompt === "reject" ? "rejected" : "replacement_requested", reason.trim());
      setPrompt(null);
    } catch (e) { setErr(e?.response?.data?.detail || "Failed"); } finally { setBusy(false); }
  };

  return (
    <div className="rs-card p-5" data-testid={`doc-row-${idx}`}>
      <div className="flex items-start gap-4">
        <Icon className="w-8 h-8 text-[#C5A880] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[#0A192F] flex items-center gap-2 flex-wrap">
            <span>{d.type}</span>
            {d.is_sensitive && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Sensitive</span>}
            <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${status.cls}`} data-testid={`doc-status-${idx}`}>{status.label}</span>
          </div>
          <div className="text-xs text-slate-500 truncate">{d.filename} · {d.size ? `${Math.round(d.size / 1024)} KB` : ""} · {new Date(d.uploaded_at).toLocaleString()}</div>
          {d.review_reason && (
            <div className="text-xs mt-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-semibold text-slate-700">Reason: </span>
              <span className="text-slate-600">{d.review_reason}</span>
              {d.reviewed_by && <span className="text-slate-400 ml-2">— {d.reviewed_by}, {d.reviewed_at ? new Date(d.reviewed_at).toLocaleString() : ""}</span>}
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-1.5 flex-shrink-0">
          <button onClick={onView} className="rs-btn-outline !py-1.5 !px-3 text-xs" data-testid={`view-doc-${idx}`}>
            <Eye className="w-3.5 h-3.5" /> View
          </button>
        </div>
      </div>
      {!prompt && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2 flex-wrap" data-testid={`doc-actions-${idx}`}>
          <button onClick={() => act("verify")} disabled={busy || d.status === "verified"} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition" data-testid={`doc-verify-${idx}`}>
            <ShieldCheck className="w-3.5 h-3.5" /> Verify
          </button>
          <button onClick={() => act("replace")} disabled={busy || d.status === "replacement_requested"} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition" data-testid={`doc-replace-${idx}`}>
            <RefreshCw className="w-3.5 h-3.5" /> Request Replacement
          </button>
          <button onClick={() => act("reject")} disabled={busy || d.status === "rejected"} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition" data-testid={`doc-reject-${idx}`}>
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
        </div>
      )}
      {prompt && (
        <div className="mt-4 pt-3 border-t border-slate-100 space-y-2" data-testid={`doc-prompt-${idx}`}>
          <label className="text-xs font-semibold text-slate-600">
            {prompt === "reject" ? "Why are you rejecting this document?" : "What does the applicant need to do?"}
          </label>
          <textarea
            rows={2} className="rs-input text-sm" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder={prompt === "reject" ? "e.g. Document is blurry, unreadable" : "e.g. Upload your most recent paystub (within 30 days)"}
            data-testid={`doc-reason-${idx}`}
          />
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setPrompt(null); setErr(""); }} className="px-3 py-1.5 text-xs text-slate-500 hover:text-[#0A192F]">Cancel</button>
            <button onClick={submitPrompt} disabled={busy} className="rs-btn-primary !py-1.5 !px-3 text-xs" data-testid={`doc-prompt-submit-${idx}`}>
              {busy ? "Saving…" : (prompt === "reject" ? "Reject Document" : "Request Replacement")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
