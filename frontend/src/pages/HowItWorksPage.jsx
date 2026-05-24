import React from "react";
import { Link } from "react-router-dom";
import SiteLayout from "@/components/site/SiteLayout";
import { ShieldCheck, Search, ClipboardList, Upload, Activity, ArrowRight } from "lucide-react";

const STEPS = [
  { icon: Search, title: "Browse Verified Properties", body: "Filter by city, rent, beds, and pet policy. Every listing is added by an authorized property manager." },
  { icon: ClipboardList, title: "Choose Your Property", body: "Open the property detail page to see all the requirements, fees, and required documents." },
  { icon: ShieldCheck, title: "Complete Pre-Approval", body: "Step through 7 clean form sections — personal info, address, income, history, occupants, consent." },
  { icon: Upload, title: "Upload Documents & Pay", body: "Securely upload ID, paystubs, W-2, and pay the disclosed application fee with PayPal." },
  { icon: Activity, title: "Track Your Application", body: "Use your application number to track 11 stages of screening and the final manager decision." },
];

export default function HowItWorksPage() {
  return (
    <SiteLayout>
      <section className="bg-[#0A192F] text-white py-16" data-testid="how-page">
        <div className="rs-container">
          <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold mb-3">How It Works</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold">A simpler way to apply for a rental.</h1>
          <p className="text-slate-300 mt-4 max-w-2xl">From browsing properties to receiving your final decision — here's what to expect.</p>
        </div>
      </section>
      <section className="rs-container py-16 space-y-5">
        {STEPS.map((s, i) => (
          <div key={s.title} className="rs-card p-7 flex items-start gap-5">
            <div className="w-12 h-12 rounded-lg bg-[#0A192F] flex items-center justify-center flex-shrink-0">
              <s.icon className="w-6 h-6 text-[#C5A880]" />
            </div>
            <div className="flex-1">
              <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold">Step {i + 1}</div>
              <h3 className="font-display text-xl font-semibold text-[#0A192F] mt-1">{s.title}</h3>
              <p className="text-slate-600 mt-2">{s.body}</p>
            </div>
          </div>
        ))}
        <div className="text-center pt-6">
          <Link to="/properties" className="rs-btn-primary inline-flex">Browse Properties <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </section>
    </SiteLayout>
  );
}
