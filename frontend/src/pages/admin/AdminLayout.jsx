import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard, Building2, ClipboardList, Users, CreditCard, FileText,
  Activity, Star, BadgeDollarSign, UserCog, Settings, BookOpen, LogOut, ShieldCheck,
} from "lucide-react";

const ITEMS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/properties", label: "Properties", icon: Building2 },
  { to: "/admin/applications", label: "Applications", icon: ClipboardList },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/refunds", label: "Refund Requests", icon: BadgeDollarSign },
  { to: "/admin/audit", label: "Audit Logs", icon: Activity },
  { to: "/admin/users", label: "Admin Users", icon: UserCog, superOnly: true },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout() {
  const { user, logout, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !user) navigate("/admin/login");
  }, [ready, user, navigate]);

  if (!ready || !user) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>;

  return (
    <div className="min-h-screen flex" data-testid="admin-shell">
      <aside className="w-64 bg-[#0A192F] text-white flex-shrink-0 hidden md:flex flex-col">
        <div className="p-5 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-[#C5A880]" /></div>
          <div>
            <div className="font-display font-bold">RentSure</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Admin Portal</div>
          </div>
        </div>
        <nav className="flex-1 px-3 pb-3 space-y-1 overflow-y-auto">
          {ITEMS.filter((it) => !it.superOnly || user.role === "super_admin").map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${isActive ? "bg-[#C5A880] text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`
              }
              data-testid={`admin-nav-${it.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <it.icon className="w-4 h-4" /> {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="px-2 mb-3">
            <div className="text-xs text-slate-400">{user.email}</div>
            <div className="text-xs text-[#C5A880] uppercase tracking-widest">{user.role?.replace("_", " ")}</div>
          </div>
          <button onClick={() => { logout(); navigate("/admin/login"); }} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white" data-testid="admin-logout">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-[#F8F9FA] min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
