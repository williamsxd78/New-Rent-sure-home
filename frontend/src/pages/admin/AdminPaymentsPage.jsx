import React, { useEffect, useState } from "react";
import { api, formatMoney } from "@/lib/api";

export default function AdminPaymentsPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get("/admin/applications").then((r) => setItems(r.data));
  }, []);

  return (
    <div className="p-6 lg:p-10" data-testid="admin-payments">
      <h1 className="font-display text-3xl font-bold text-[#0A192F] mb-8">Payments</h1>
      <div className="rs-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 text-left">
            <tr><th className="p-4">Application</th><th className="p-4">Applicant</th><th className="p-4">Property</th><th className="p-4">Amount</th><th className="p-4">Status</th><th className="p-4">Transaction</th></tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="p-4 font-mono text-xs">{a.application_number}</td>
                <td className="p-4">{a.applicant_name}</td>
                <td className="p-4 text-slate-600">{a.property_title}</td>
                <td className="p-4">{formatMoney(a.payment?.amount || 0)}</td>
                <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-xs ${a.payment?.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{a.payment?.status || "pending"}</span></td>
                <td className="p-4 font-mono text-xs text-slate-500">{a.payment?.transaction_id || "—"}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-slate-400">No payments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
