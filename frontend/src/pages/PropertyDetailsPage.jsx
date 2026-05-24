import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import SiteLayout from "@/components/site/SiteLayout";
import { api, formatMoney, resolvePropertyImage } from "@/lib/api";
import {
  MapPin, Bed, Bath, Maximize, Calendar, Car, Zap, PawPrint, FileText,
  ShieldCheck, BadgeCheck, AlertCircle, CircleDollarSign, Lock,
} from "lucide-react";

export default function PropertyDetailsPage() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [active, setActive] = useState(0);

  useEffect(() => { api.get(`/properties/${id}`).then((r) => setP(r.data)); }, [id]);

  if (!p) return <SiteLayout><div className="rs-container py-20 text-slate-500">Loading…</div></SiteLayout>;

  return (
    <SiteLayout>
      <section className="rs-container py-10" data-testid="property-details">
        <Link to="/properties" className="text-sm text-slate-500 hover:text-[#0A192F]">← Back to Properties</Link>

        {/* Gallery */}
        <div className="mt-6 grid lg:grid-cols-4 gap-3" data-testid="property-gallery">
          <div className="lg:col-span-3 aspect-[16/10] rounded-2xl overflow-hidden bg-slate-100">
            <img src={resolvePropertyImage(p, active)} alt={p.title} className="w-full h-full object-cover" />
          </div>
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-3">
            {(p.images || []).map((img, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`aspect-[4/3] rounded-xl overflow-hidden border-2 transition ${active === i ? "border-[#0A192F]" : "border-transparent"}`}
                data-testid={`gallery-thumb-${i}`}
              >
                <img src={resolvePropertyImage(p, i)} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-8">
            {/* Title */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {(p.tags || []).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                    <BadgeCheck className="w-3 h-3" /> {t}
                  </span>
                ))}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0A192F]">{p.title}</h1>
              <div className="text-slate-500 mt-2 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {p.address}, {p.city}, {p.state} {p.zip_code}</div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat icon={Bed} label="Bedrooms" value={p.bedrooms || "Studio"} />
              <Stat icon={Bath} label="Bathrooms" value={p.bathrooms} />
              <Stat icon={Maximize} label="Square Feet" value={`${p.square_feet}`} />
              <Stat icon={Calendar} label="Available" value={p.availability_date || "Now"} />
            </div>

            {/* Description */}
            <div className="rs-card p-7">
              <h2 className="font-display text-xl font-semibold text-[#0A192F] mb-3">About this property</h2>
              <p className="text-slate-600 leading-relaxed">{p.description}</p>
            </div>

            {/* Amenities */}
            {p.amenities?.length > 0 && (
              <div className="rs-card p-7">
                <h2 className="font-display text-xl font-semibold text-[#0A192F] mb-4">Amenities</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {p.amenities.map((a) => (
                    <div key={a} className="flex items-center gap-2 text-sm text-slate-700"><BadgeCheck className="w-4 h-4 text-emerald-600" /> {a}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Spec Grid */}
            <div className="rs-card p-7">
              <h2 className="font-display text-xl font-semibold text-[#0A192F] mb-4">Property Details</h2>
              <div className="grid sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <Row label="Lease term" value={p.lease_term} />
                <Row label="Parking" value={p.parking} icon={Car} />
                <Row label="Utilities" value={p.utilities} icon={Zap} />
                <Row label="Pet policy" value={p.pet_policy} icon={PawPrint} />
                <Row label="Required income" value={`${formatMoney(p.required_income)}/mo`} />
                <Row label="Security deposit" value={formatMoney(p.deposit)} />
              </div>
            </div>

            {/* Required Documents */}
            <div className="rs-card p-7" data-testid="required-documents">
              <h2 className="font-display text-xl font-semibold text-[#0A192F] mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-[#C5A880]" /> Required Documents</h2>
              <ul className="space-y-2 text-sm text-slate-700">
                {(p.required_documents || []).map((d) => (
                  <li key={d} className="flex items-start gap-2"><BadgeCheck className="w-4 h-4 text-emerald-600 mt-0.5" /> {d}</li>
                ))}
              </ul>
              {p.require_ssn && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3" data-testid="ssn-notice">
                  <Lock className="w-5 h-5 text-amber-700 mt-0.5" />
                  <div className="text-sm text-amber-900 leading-relaxed">
                    <strong>SSN document is required for this property.</strong> Your SSN document is used only for rental application verification and screening where legally permitted. It is encrypted, access-restricted, and visible only to authorized main admin when required.
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 flex gap-3 text-sm text-slate-600" data-testid="application-disclaimer">
              <AlertCircle className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" />
              <div>Submitting an application does not guarantee approval. Final decision is subject to property criteria, screening results, and manager review.</div>
            </div>
          </div>

          {/* Sticky Sidebar */}
          <div className="space-y-5">
            <div className="rs-card p-7 sticky top-24" data-testid="apply-box">
              <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold">Monthly Rent</div>
              <div className="font-display text-3xl font-bold text-[#0A192F] mt-1">{formatMoney(p.rent)}<span className="text-base font-normal text-slate-500">/mo</span></div>
              <div className="mt-5 space-y-2 text-sm text-slate-600">
                <div className="flex justify-between"><span>Security deposit</span><span className="font-medium text-[#0A192F]">{formatMoney(p.deposit)}</span></div>
                <div className="flex justify-between"><span>Application fee</span><span className="font-medium text-[#0A192F]">{formatMoney(p.application_fee)}</span></div>
                <div className="flex justify-between"><span>Required income</span><span className="font-medium text-[#0A192F]">{formatMoney(p.required_income)}/mo</span></div>
              </div>
              <Link to={`/apply/${p.slug || p.id}`} className="rs-btn-primary w-full mt-6" data-testid="apply-cta">
                <CircleDollarSign className="w-4 h-4" /> Start Pre-Approval
              </Link>
              <div className="mt-5 pt-5 border-t border-slate-100 space-y-2.5 text-xs text-slate-500">
                <div className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verified property listing</div>
                <div className="flex items-center gap-2"><Lock className="w-3.5 h-3.5 text-emerald-600" /> Encrypted document upload</div>
                <div className="flex items-center gap-2"><BadgeCheck className="w-3.5 h-3.5 text-emerald-600" /> Manager-reviewed applications</div>
              </div>
            </div>

            <div className="rs-card p-6" data-testid="manager-box">
              <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold mb-2">Broker / Manager</div>
              <div className="font-display font-semibold text-[#0A192F]">{p.broker_name || "RentSure Property Management"}</div>
              <div className="text-sm text-slate-500 mt-1">Authorized property manager</div>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

const Stat = ({ icon: Icon, label, value }) => (
  <div className="rs-card p-4">
    <Icon className="w-5 h-5 text-[#C5A880]" />
    <div className="text-xs text-slate-500 mt-2">{label}</div>
    <div className="font-display font-semibold text-[#0A192F]">{value}</div>
  </div>
);

const Row = ({ label, value, icon: Icon }) => (
  <div className="flex items-start gap-2">
    {Icon && <Icon className="w-4 h-4 text-slate-400 mt-0.5" />}
    <div>
      <div className="text-slate-500 text-xs">{label}</div>
      <div className="font-medium text-[#0A192F]">{value}</div>
    </div>
  </div>
);
