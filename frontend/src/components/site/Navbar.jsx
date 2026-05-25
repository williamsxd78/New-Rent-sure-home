import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ShieldCheck, Menu, X } from "lucide-react";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/properties", label: "Properties" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/about", label: "About Us" },
  { to: "/reviews", label: "Reviews" },
  { to: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();

  return (
    <header className="rs-glass sticky top-0 z-50" data-testid="site-navbar">
      <div className="rs-container flex items-center justify-between h-16 lg:h-20">
        <Link to="/" className="flex items-center gap-2.5" data-testid="logo-link">
          <div className="w-9 h-9 rounded-lg bg-[#0A192F] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#C5A880]" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-[#0A192F] text-lg">RentSure Homes</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Verified Rentals</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={`nav-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${isActive ? "text-[#0A192F]" : "text-slate-600 hover:text-[#0A192F]"}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <button onClick={() => navigate("/track")} className="rs-btn-outline !py-2 !px-4 text-sm" data-testid="nav-track-application">
            Track Application
          </button>
        </div>

        <button className="lg:hidden p-2" onClick={() => setOpen(!open)} data-testid="nav-toggle">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-slate-200 bg-white">
          <div className="rs-container py-4 flex flex-col gap-3">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="text-slate-700 font-medium py-2"
                data-testid={`nav-m-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {n.label}
              </NavLink>
            ))}
            <button onClick={() => { setOpen(false); navigate("/track"); }} className="rs-btn-outline" data-testid="nav-m-track">
              Track Application
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
