import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SiteLayout from "@/components/site/SiteLayout";
import PropertyCard from "@/components/site/PropertyCard";
import { api } from "@/lib/api";
import {
  ShieldCheck, FileCheck, ScanLine, UserCheck, Scale, BadgeDollarSign,
  Search, ClipboardList, Upload, CreditCard, Activity, Star, ArrowRight,
} from "lucide-react";

const TRUST_BADGES = [
  { icon: BadgeDollarSign, label: "Verified Property Listings" },
  { icon: FileCheck, label: "Secure Document Upload" },
  { icon: UserCheck, label: "Licensed Broker / Manager Review" },
  { icon: Activity, label: "Transparent Application Tracking" },
  { icon: Scale, label: "Fair Housing Compliant Process" },
];

const DIFFERENT_CARDS = [
  { icon: ShieldCheck, title: "Verified Properties Only", body: "Every listed property is added by authorized managers, brokers, or property owners." },
  { icon: ClipboardList, title: "Step-by-Step Application", body: "Applicants complete the process one step at a time, reducing confusion and missing documents." },
  { icon: FileCheck, title: "Secure Document Handling", body: "Sensitive documents are uploaded through a protected applicant portal and visible only to authorized admins." },
  { icon: Activity, title: "Transparent Status Tracking", body: "Applicants can track each stage of their rental application in real time." },
  { icon: UserCheck, title: "Professional Review Process", body: "Applications are reviewed by authorized managers before any final decision is made." },
  { icon: Scale, title: "Clear Fee & Refund Policy", body: "Application and screening fees are clearly explained before payment." },
];

const HOW_STEPS = [
  { icon: Search, title: "Browse Verified Properties" },
  { icon: ScanLine, title: "Choose Your Property" },
  { icon: ClipboardList, title: "Complete Pre-Approval" },
  { icon: Upload, title: "Upload Documents & Pay Fee" },
  { icon: Activity, title: "Track Your Application" },
];

export default function HomePage() {
  const [props, setProps] = useState([]);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    api.get("/properties?sort=newest").then((r) => setProps(r.data.slice(0, 6)));
    api.get("/reviews").then((r) => setReviews(r.data));
  }, []);

  return (
    <SiteLayout>
      {/* HERO */}
      <section className="relative overflow-hidden" data-testid="home-hero">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1920&q=80"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A192F]/95 via-[#0A192F]/80 to-[#0A192F]/30" />
        </div>
        <div className="relative rs-container pt-20 pb-24 lg:pt-32 lg:pb-40 text-white">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs uppercase tracking-[0.18em] mb-6">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C5A880]" /> Verified Rentals · Transparent Screening
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight">
              Find Verified Rental Homes With a Simple <span className="text-[#C5A880]">Online Application</span>
            </h1>
            <p className="mt-6 text-lg text-slate-200 leading-relaxed max-w-2xl">
              Browse verified apartments and homes, check your eligibility, submit documents securely, pay your application fee, and track your rental application from start to finish.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/properties" className="rs-btn-gold" data-testid="hero-browse-btn">
                Browse Properties <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/properties" className="rs-btn-outline !text-white !border-white/30 hover:!bg-white/10" data-testid="hero-preapproval-btn">
                Start Pre-Approval
              </Link>
            </div>

            {/* Trust badges */}
            <div className="mt-12 flex flex-wrap gap-x-6 gap-y-3">
              {TRUST_BADGES.map((b) => (
                <div key={b.label} className="flex items-center gap-2 text-sm text-slate-200">
                  <b.icon className="w-4 h-4 text-[#C5A880]" /> {b.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="rs-section" data-testid="about-section">
        <div className="rs-container grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold mb-3">About RentSure Homes</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#0A192F]">
              A simpler, more transparent way to apply for a rental.
            </h2>
            <p className="mt-5 text-slate-600 leading-relaxed">
              We help renters apply for verified rental homes and apartments through a simple, secure, and transparent online process. Our platform connects applicants with available rental properties managed by authorized owners, brokers, and property managers. From pre-approval to document submission and application tracking, we make the rental process easier, faster, and more organized.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-4">
              <div className="rs-stat"><div className="text-2xl font-display font-bold text-[#0A192F]">{props.length}+</div><div className="text-xs text-slate-500 mt-1">Active Listings</div></div>
              <div className="rs-stat"><div className="text-2xl font-display font-bold text-[#0A192F]">100%</div><div className="text-xs text-slate-500 mt-1">Verified Owners</div></div>
              <div className="rs-stat"><div className="text-2xl font-display font-bold text-[#0A192F]">24/7</div><div className="text-xs text-slate-500 mt-1">Status Tracking</div></div>
            </div>
          </div>
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1600494448850-6013c64ba722?w=1200&q=80"
              alt="About RentSure Homes"
              className="rounded-2xl shadow-xl w-full"
            />
            <div className="absolute -bottom-6 -left-6 bg-white p-5 rounded-xl shadow-xl border border-slate-100 max-w-xs hidden md:block">
              <div className="flex items-center gap-2 text-[#0A192F] font-semibold"><ShieldCheck className="w-5 h-5 text-emerald-600" /> Secure Process</div>
              <div className="text-xs text-slate-500 mt-1">Encrypted document handling. Mask-by-default SSN. Audit trail on every access.</div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW WE ARE DIFFERENT */}
      <section className="bg-[#F8F9FA] rs-section" data-testid="different-section">
        <div className="rs-container">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold mb-3">How We Are Different</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#0A192F]">Built for trust, transparency, and clarity.</h2>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {DIFFERENT_CARDS.map((c) => (
              <div key={c.title} className="rs-card p-7" data-testid={`different-card-${c.title.replace(/\s+/g, "-").toLowerCase()}`}>
                <div className="w-11 h-11 rounded-lg bg-[#0A192F] text-[#C5A880] flex items-center justify-center mb-4">
                  <c.icon className="w-5 h-5" />
                </div>
                <h3 className="font-display font-semibold text-lg text-[#0A192F]">{c.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed mt-2">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="rs-section" data-testid="how-it-works-section">
        <div className="rs-container">
          <div className="max-w-2xl mb-12">
            <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold mb-3">How It Works</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#0A192F]">From browsing to move-in, in 5 clear steps.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {HOW_STEPS.map((s, i) => (
              <div key={s.title} className="rs-card p-6" data-testid={`step-${i + 1}`}>
                <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold">Step {i + 1}</div>
                <div className="w-10 h-10 rounded-lg bg-[#F8F9FA] flex items-center justify-center mt-3">
                  <s.icon className="w-5 h-5 text-[#0A192F]" />
                </div>
                <div className="mt-3 font-display font-semibold text-[#0A192F]">{s.title}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED PROPERTIES */}
      <section className="bg-[#F8F9FA] rs-section" data-testid="featured-section">
        <div className="rs-container">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold mb-3">Featured Properties</div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#0A192F]">Hand-picked verified rentals</h2>
            </div>
            <Link to="/properties" className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-[#0A192F] hover:text-[#C5A880]">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {props.map((p) => <PropertyCard key={p.id} p={p} />)}
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="rs-section" data-testid="reviews-section">
        <div className="rs-container">
          <div className="max-w-2xl mb-3">
            <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold mb-3">Sample Reviews</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#0A192F]">What renters appreciate about the process</h2>
          </div>
          <p className="text-sm text-slate-500 mb-10 max-w-2xl">Real customer reviews will appear here after verified applicants submit feedback.</p>
          <div className="grid md:grid-cols-3 gap-5">
            {reviews.map((r) => (
              <div key={r.id} className="rs-card p-7" data-testid={`review-${r.id}`}>
                <div className="flex items-center gap-1 text-[#C5A880]">
                  {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                </div>
                <p className="text-slate-700 mt-4 leading-relaxed">"{r.text}"</p>
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <div className="font-display font-semibold text-[#0A192F]">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.location} · <span className="text-[#C5A880]">Sample Review</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
