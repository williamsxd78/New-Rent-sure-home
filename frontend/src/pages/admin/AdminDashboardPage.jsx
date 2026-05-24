import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatMoney } from "@/lib/api";
import {
  Building2, ClipboardList, CreditCard, CheckCircle2, AlertTriangle, Clock, Star, BadgeDollarSign,
} from "lucide-react";

const CARDS = [
  { key: "total_properties", label: "Total Properties", icon: Building2, color: "text-blue-700 bg-blue-50" },
  { key: "active_properties", label: "Active Properties", icon: Building2, color: "text-emerald-700 bg-emerald-50" },
  { key: "total_applications", label: "Total Applications", icon: ClipboardList, color: "text-indigo-700 bg-indigo-50" },
  { key: "paid_applications", label: "Paid Applications", icon: CreditCard, color: "text-amber-700 bg-amber-50" },
  { key: "pending_review", label: "Pending Review", icon: Clock, color: "text-slate-700 bg-slate-100" },
  { key: "approved", label: "Approved", icon: CheckCircle2, color: "text-emerald-700 bg-emerald-50" },
  { key: "not_qualified", label: "Not Qualified", icon: AlertTriangle, color: "text-red-700 bg-red-50" },
  { key: "refund_requests", label: "Refund Requests", icon: BadgeDollarSign, color: "text-fuchsia-700 bg-fuchsia-50" },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({});

  useEffect(() => { api.get("/admin/dashboard").then((r) => setStats(r.data)); }, []);

  return (
    <div className="p-6 lg:p-10" data-testid="admin-dashboard">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold">Overview</div>
          <h1 className="font-display text-3xl font-bold text-[#0A192F] mt-1">Dashboard</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {CARDS.map((c) => (
          <div key={c.key} className="rs-card p-5" data-testid={`stat-${c.key}`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${c.color}`}>
              <c.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-display font-bold text-[#0A192F]">{stats[c.key] ?? "—"}</div>
            <div className="text-xs text-slate-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid lg:grid-cols-2 gap-6">
        <Link to="/admin/applications" className="rs-card p-7 hover:bg-slate-50">
          <div className="font-display font-semibold text-[#0A192F]">Review Applications</div>
          <p className="text-sm text-slate-500 mt-1">Update screening status, view documents, and set final decisions.</p>
        </Link>
        <Link to="/admin/properties" className="rs-card p-7 hover:bg-slate-50">
          <div className="font-display font-semibold text-[#0A192F]">Manage Properties</div>
          <p className="text-sm text-slate-500 mt-1">Add, edit, or archive listings. Set application fees and requirements.</p>
        </Link>
      </div>
    </div>
  );
}
