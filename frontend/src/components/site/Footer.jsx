import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Mail, Phone, MapPin } from "lucide-react";

const POLICY_LINKS = [
  { to: "/policies/privacy", label: "Privacy Policy" },
  { to: "/policies/terms", label: "Terms & Conditions" },
  { to: "/policies/refund", label: "Refund Policy" },
  { to: "/policies/application-fee", label: "Application Fee Policy" },
  { to: "/policies/fair-housing", label: "Fair Housing Policy" },
  { to: "/policies/screening-disclosure", label: "Tenant Screening Disclosure" },
  { to: "/policies/fcra", label: "FCRA Authorization" },
  { to: "/policies/e-signature", label: "Electronic Signature Consent" },
  { to: "/policies/data-retention", label: "Data Retention & Deletion" },
];

export default function Footer() {
  return (
    <footer className="bg-[#0A192F] text-slate-300 mt-20" data-testid="site-footer">
      <div className="rs-container py-16 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#C5A880]" />
            </div>
            <div className="font-display font-bold text-white text-lg">RentSure Homes</div>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Verified Rentals. Simple Applications. Transparent Screening.
          </p>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">Quick Links</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/properties" className="hover:text-white">Properties</Link></li>
            <li><Link to="/how-it-works" className="hover:text-white">How It Works</Link></li>
            <li><Link to="/track" className="hover:text-white">Track Application</Link></li>
            <li><Link to="/about" className="hover:text-white">About Us</Link></li>
            <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
          </ul>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">Policies</div>
          <ul className="space-y-2 text-sm">
            {POLICY_LINKS.map((p) => (
              <li key={p.to}><Link to={p.to} className="hover:text-white">{p.label}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">Contact</div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2"><Mail className="w-4 h-4 mt-0.5" /> support@rentsurehomes.com</li>
            <li className="flex items-start gap-2"><Phone className="w-4 h-4 mt-0.5" /> 1-800-RENT-SURE</li>
            <li className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5" /> 4500 Heritage Blvd, Austin, TX</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="rs-container py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-slate-500">
          <div>© {new Date().getFullYear()} RentSure Homes. All rights reserved.</div>
          <div className="max-w-2xl leading-relaxed">
            Rental approval is subject to property requirements, applicant information, screening results, and manager review.
          </div>
        </div>
      </div>
    </footer>
  );
}
