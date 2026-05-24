import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AdminAuditPage() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/admin/audit-logs").then((r) => setItems(r.data)); }, []);

  return (
    <div className="p-6 lg:p-10" data-testid="admin-audit">
      <h1 className="font-display text-3xl font-bold text-[#0A192F] mb-2">Audit Logs</h1>
      <p className="text-sm text-slate-500 mb-8">Records of sensitive document access (e.g., full SSN views).</p>
      <div className="rs-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 text-left">
            <tr><th className="p-4">When</th><th className="p-4">Admin</th><th className="p-4">Action</th><th className="p-4">Application</th><th className="p-4">Reason</th></tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="p-4 text-xs text-slate-500">{new Date(l.created_at).toLocaleString()}</td>
                <td className="p-4">{l.admin_email}<br /><span className="text-xs text-slate-400">{l.admin_role}</span></td>
                <td className="p-4 font-mono text-xs">{l.action}</td>
                <td className="p-4 font-mono text-xs">{l.application_id}</td>
                <td className="p-4 text-slate-600">{l.reason}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-slate-400">No audit entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
