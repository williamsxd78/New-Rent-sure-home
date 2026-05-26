import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import SiteLayout from "@/components/site/SiteLayout";
import { api, formatMoney, resolvePropertyImage, BACKEND_URL } from "@/lib/api";
import {
  MapPin, Bed, Bath, Maximize, Calendar, Car, Zap, PawPrint, FileText,
  ShieldCheck, BadgeCheck, AlertCircle, CircleDollarSign, Lock, Share2, Check,
  Grid3x3, ChevronLeft, ChevronRight, X,
} from "lucide-react";

export default function PropertyDetailsPage() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [lightbox, setLightbox] = useState(-1); // -1 = closed, else image index

  useEffect(() => { api.get(`/properties/${id}`).then((r) => setP(r.data)); }, [id]);

  if (!p) return <SiteLayout><div className="rs-container py-20 text-slate-500">Loading…</div></SiteLayout>;

  return (
    <SiteLayout>
      <section className="rs-container py-10" data-testid="property-details">
        <Link to="/properties" className="text-sm text-slate-500 hover:text-[#0A192F]">← Back to Properties</Link>

        {/* Premium gallery — hero + 4 thumb grid + lightbox.
            Fixed-height row keeps the page from breaking with many images. */}
        <PropertyGallery property={p} onOpen={(i) => setLightbox(i)} />
        {lightbox >= 0 && (
          <Lightbox
            property={p}
            startIndex={lightbox}
            onClose={() => setLightbox(-1)}
          />
        )}

        <div className="mt-10 grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-8">
            {/* Title */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {(p.tags || []).filter((t) => t && t.toLowerCase() !== "imported").map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                    <BadgeCheck className="w-3 h-3" /> {t}
                  </span>
                ))}
              </div>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0A192F]">{p.title}</h1>
                  <div className="text-slate-500 mt-2 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {p.address}, {p.city}, {p.state} {p.zip_code}</div>
                </div>
                <ShareButton property={p} />
              </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// Premium image gallery — Realtor/Apartments.com-style 2-image hero.
// Layout never breaks regardless of image count (1, 2, or 50).
// ─────────────────────────────────────────────────────────────────────────────
function PropertyGallery({ property, onOpen }) {
  const images = property.images || [];
  const n = images.length;

  if (n === 0) {
    return (
      <div className="mt-6 aspect-[16/9] rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
        No photos yet
      </div>
    );
  }

  // 1-image: hero only, full width
  if (n === 1) {
    return (
      <div className="mt-6 aspect-[16/9] rounded-2xl overflow-hidden bg-slate-100 cursor-zoom-in group" data-testid="property-gallery">
        <img
          src={resolvePropertyImage(property, 0)}
          alt={property.title}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          onClick={() => onOpen(0)}
        />
      </div>
    );
  }

  // 2+ images: big hero (60%) + big secondary (40%) side by side.
  // When n > 2, the secondary image gets a "+N photos" overlay so users
  // know there are more. Click either → opens the lightbox.
  const extra = Math.max(0, n - 2);
  return (
    <div
      className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-3 h-auto lg:h-[520px]"
      data-testid="property-gallery"
    >
      {/* Hero — 3/5 of the row (60%) on desktop */}
      <button
        onClick={() => onOpen(0)}
        className="lg:col-span-3 aspect-[16/10] lg:aspect-auto lg:h-full rounded-2xl overflow-hidden bg-slate-100 cursor-zoom-in group"
        data-testid="gallery-hero"
      >
        <img
          src={resolvePropertyImage(property, 0)}
          alt={property.title}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
        />
      </button>

      {/* Secondary — 2/5 (40%) — full height */}
      <button
        onClick={() => onOpen(1)}
        className="lg:col-span-2 aspect-[16/10] lg:aspect-auto lg:h-full rounded-2xl overflow-hidden bg-slate-100 cursor-zoom-in group relative"
        data-testid="gallery-thumb-1"
      >
        <img
          src={resolvePropertyImage(property, 1)}
          alt={`${property.title} photo 2`}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
        />
        {extra > 0 && (
          <div
            className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center text-white pointer-events-none"
            data-testid="gallery-more-overlay"
          >
            <Grid3x3 className="w-7 h-7 mb-1.5" />
            <div className="font-display font-semibold text-lg">+{extra} photos</div>
            <div className="text-xs uppercase tracking-wider opacity-70 mt-0.5">Tap to view all</div>
          </div>
        )}
      </button>
    </div>
  );
}

function Lightbox({ property, startIndex, onClose }) {
  const images = property.images || [];
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIdx((i) => (i + 1) % images.length);
      else if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [images.length, onClose]);

  if (!images.length) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="property-lightbox"
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
        aria-label="Close gallery"
        data-testid="lightbox-close"
      >
        <X className="w-6 h-6" />
      </button>
      <div className="absolute top-5 left-5 text-white/80 text-sm font-medium" data-testid="lightbox-counter">
        {idx + 1} / {images.length}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + images.length) % images.length); }}
        className="absolute left-3 sm:left-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
        aria-label="Previous photo"
        data-testid="lightbox-prev"
      >
        <ChevronLeft className="w-7 h-7" />
      </button>
      <img
        src={resolvePropertyImage(property, idx)}
        alt={`${property.title} photo ${idx + 1}`}
        className="max-w-[92vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % images.length); }}
        className="absolute right-3 sm:right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
        aria-label="Next photo"
        data-testid="lightbox-next"
      >
        <ChevronRight className="w-7 h-7" />
      </button>

      {/* Thumbnail strip */}
      <div
        className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[92vw] overflow-x-auto pb-1"
        onClick={(e) => e.stopPropagation()}
      >
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`flex-shrink-0 w-16 h-12 rounded-md overflow-hidden border-2 ${i === idx ? "border-[#C5A880]" : "border-transparent opacity-60 hover:opacity-100"} transition`}
            aria-label={`Go to photo ${i + 1}`}
            data-testid={`lightbox-thumb-${i}`}
          >
            <img src={resolvePropertyImage(property, i)} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}


function ShareButton({ property }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const slug = property.slug || property.id;
  // Use the backend share endpoint so social scrapers (FB / WhatsApp / Twitter / Slack) see OG tags
  const shareUrl = `${BACKEND_URL}/api/share/property/${slug}`;
  const title = `${property.title} — ${property.city}, ${property.state}`;
  const text = `Check out this rental: ${title}`;

  const handleNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
        return;
      } catch (_) { /* user cancelled */ }
    }
    setOpen((v) => !v);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (_) { /* noop */ }
  };

  const enc = (s) => encodeURIComponent(s);
  const channels = [
    { name: "WhatsApp", color: "#25D366", href: `https://wa.me/?text=${enc(text + " " + shareUrl)}` },
    { name: "Facebook", color: "#1877F2", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}` },
    { name: "Twitter / X", color: "#000000", href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(shareUrl)}` },
    { name: "LinkedIn", color: "#0A66C2", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(shareUrl)}` },
    { name: "Telegram", color: "#26A5E4", href: `https://t.me/share/url?url=${enc(shareUrl)}&text=${enc(text)}` },
    { name: "Email", color: "#475569", href: `mailto:?subject=${enc(title)}&body=${enc(text + "\n\n" + shareUrl)}` },
  ];

  return (
    <div className="relative" data-testid="share-button">
      <button onClick={handleNative} className="rs-btn-outline !py-2 !px-3 text-sm whitespace-nowrap" aria-label="Share property" data-testid="share-btn">
        <Share2 className="w-4 h-4" /> Share
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-72 bg-white border border-slate-200 rounded-xl shadow-xl shadow-[#0A192F]/10 p-3 rs-fade-in" data-testid="share-panel">
          <div className="font-display font-semibold text-sm text-[#0A192F] mb-2">Share this property</div>
          <button
            onClick={copy}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition text-sm"
            data-testid="share-copy-btn"
          >
            <span className="truncate text-slate-600 text-xs font-mono">{shareUrl.replace(/^https?:\/\//, "")}</span>
            <span className={`flex items-center gap-1 text-xs font-semibold ${copied ? "text-emerald-600" : "text-[#0A192F]"}`}>
              {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : "Copy"}
            </span>
          </button>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {channels.map((c) => (
              <a
                key={c.name}
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-2 rounded-lg border border-slate-200 text-[11px] text-center hover:bg-slate-50 transition"
                style={{ borderTopColor: c.color, borderTopWidth: 3 }}
                data-testid={`share-${c.name.toLowerCase().split(" ")[0]}`}
              >
                {c.name}
              </a>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-3 text-center">Link auto-generates rich preview on social media.</p>
        </div>
      )}
    </div>
  );
}
