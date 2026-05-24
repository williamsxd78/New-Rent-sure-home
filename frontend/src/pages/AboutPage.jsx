import React from "react";
import SiteLayout from "@/components/site/SiteLayout";
import { ShieldCheck, BadgeCheck, UserCheck, Activity } from "lucide-react";

export default function AboutPage() {
  return (
    <SiteLayout>
      <section className="bg-[#0A192F] text-white py-16">
        <div className="rs-container">
          <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold mb-3">About</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold max-w-2xl">A premium, trust-focused rental application platform.</h1>
        </div>
      </section>
      <section className="rs-container py-16 grid md:grid-cols-2 gap-12 items-start">
        <div>
          <p className="text-slate-700 leading-relaxed">
            RentSure Homes is a licensed/authorized rental property service working with property owners, apartment owners, and brokers. We help renters apply for verified rental homes and apartments through a simple, secure, and transparent online process.
          </p>
          <p className="text-slate-700 leading-relaxed mt-4">
            Our platform connects applicants with available rental properties managed by authorized owners, brokers, and property managers. From pre-approval to document submission and application tracking, we make the rental process easier, faster, and more organized.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: BadgeCheck, title: "Verified" },
            { icon: ShieldCheck, title: "Secure" },
            { icon: UserCheck, title: "Reviewed" },
            { icon: Activity, title: "Transparent" },
          ].map((s) => (
            <div key={s.title} className="rs-card p-7 text-center">
              <s.icon className="w-7 h-7 mx-auto text-[#C5A880]" />
              <div className="font-display font-semibold text-[#0A192F] mt-3">{s.title}</div>
            </div>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}
