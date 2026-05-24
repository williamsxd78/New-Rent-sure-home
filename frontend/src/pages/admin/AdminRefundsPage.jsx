import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AdminRefundsPage() {
  const [items, setItems] = useState([]);
  const load = async () => { const r = await api.get("/admin/refund-requests"); setItems(r.data); };
  useEffect(() => { load(); }, []);
  const setStatus = async (id, status) => { const fd = new FormData(); fd.append("status", status); await api.post(`/admin/refund-requests/${id}/status`, fd); load(); };

  return (
    <div className="p-6 lg:p-10" data-testid="admin-refunds">
      <h1 className="font-display text-3xl font-bold text-[#0A192F] mb-8">Refund Requests</h1>
      <div className="rs-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 text-left">
            <tr><th className="p-4">App #</th><th className="p-4">Email</th><th className="p-4">Reason</th><th className="p-4">Status</th><th className="p-4 text-right">Action</th></tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="p-4 font-mono text-xs">{r.application_number}</td>
                <td className="p-4">{r.email}</td>
                <td className="p-4 text-slate-600 max-w-md">{r.reason}</td>
                <td className="p-4"><span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">{r.status}</span></td>
                <td className="p-4 text-right">
                  <select className="rs-input !py-1.5 !w-auto text-xs" value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}>
                    <option value="open">Open</option><option value="approved">Approved</option><option value="denied">Denied</option><option value="closed">Closed</option>
                  </select>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-slate-400">No refund requests.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
