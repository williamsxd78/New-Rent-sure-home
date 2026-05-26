import React, { useEffect, useState, useRef } from "react";
import { api, formatMoney, resolvePropertyImage } from "@/lib/api";
import { Plus, Pencil, Trash2, X, Upload, ImagePlus, ChevronUp, ChevronDown, Loader2, Link as LinkIcon, AlertCircle, CheckCircle2, Sparkles, Bookmark, Copy } from "lucide-react";

const BLANK = {
  title: "", property_type: "Apartment", address: "", city: "", state: "", zip_code: "",
  rent: 0, deposit: 0, application_fee: 50, bedrooms: 1, bathrooms: 1, square_feet: 0,
  lease_term: "12 months", pet_policy: "Allowed with deposit", parking: "1 spot",
  utilities: "Tenant pays", description: "", amenities: [], required_income: 0,
  required_documents: [], availability_date: "", images: [], status: "available",
  tags: ["Verified"], pet_friendly: true, require_ssn: false, owner_name: "", broker_name: "", internal_notes: "",
};

export default function AdminPropertiesPage() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [bookmarkletOpen, setBookmarkletOpen] = useState(false);
  const [importNotes, setImportNotes] = useState([]);
  const [autoImportBusy, setAutoImportBusy] = useState(false);
  const [autoImportErr, setAutoImportErr] = useState("");

  const load = async () => {
    const r = await api.get("/admin/properties");
    setItems(r.data);
  };
  useEffect(() => { load(); }, []);

  // ──────────────────────────────────────────────────────────────────
  // Bookmarklet auto-import: when the user clicks the bookmarklet on a
  // listing site, a new tab opens to this page with `window.name` set to
  // `rs:<base64-json>` containing { url, html }. We decode it, send the HTML
  // to the importer endpoint, and open the edit modal pre-filled. This
  // skips the manual paste step entirely.
  // ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.name || !window.name.startsWith("rs:")) return;
    let payload;
    try {
      const decoded = decodeURIComponent(escape(window.atob(window.name.slice(3))));
      payload = JSON.parse(decoded);
    } catch (e) {
      window.name = "";
      setAutoImportErr("Bookmarklet payload was malformed. Please try again.");
      return;
    }
    window.name = ""; // consume the payload so refreshing doesn't re-trigger
    if (!payload?.html) return;
    setAutoImportBusy(true);
    setAutoImportErr("");
    api.post("/admin/properties/import-url", { url: payload.url || "", html: payload.html })
      .then((r) => {
        setImportNotes(r.data?.notes || []);
        setEditing({ ...BLANK, ...(r.data?.prefill || {}) });
      })
      .catch((e) => {
        setAutoImportErr(e?.response?.data?.detail || "Auto-import failed. Try the manual Import button.");
      })
      .finally(() => setAutoImportBusy(false));
  }, []);

  const save = async () => {
    const payload = { ...editing };
    if (typeof payload.amenities === "string") payload.amenities = payload.amenities.split(",").map((s) => s.trim()).filter(Boolean);
    if (typeof payload.tags === "string") payload.tags = payload.tags.split(",").map((s) => s.trim()).filter(Boolean);
    if (typeof payload.images === "string") payload.images = payload.images.split(",").map((s) => s.trim()).filter(Boolean);
    if (!Array.isArray(payload.images)) payload.images = [];
    if (typeof payload.required_documents === "string") payload.required_documents = payload.required_documents.split("\n").map((s) => s.trim()).filter(Boolean);
    payload.rent = Number(payload.rent); payload.deposit = Number(payload.deposit); payload.application_fee = Number(payload.application_fee);
    payload.bedrooms = Number(payload.bedrooms); payload.bathrooms = Number(payload.bathrooms);
    payload.square_feet = Number(payload.square_feet); payload.required_income = Number(payload.required_income);
    if (editing.id) {
      await api.put(`/admin/properties/${editing.id}`, payload);
      setEditing(null); load();
    } else {
      const r = await api.post("/admin/properties", payload);
      // Keep modal open so admin can upload images now that we have an id
      setEditing(r.data);
      load();
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this property?")) return;
    await api.delete(`/admin/properties/${id}`);
    load();
  };

  const arrToStr = (v) => Array.isArray(v) ? v.join(", ") : v;

  return (
    <div className="p-6 lg:p-10" data-testid="admin-properties">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <h1 className="font-display text-3xl font-bold text-[#0A192F]">Properties</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setBookmarkletOpen(true)} className="rs-btn-outline" data-testid="install-bookmarklet-btn"><Bookmark className="w-4 h-4" /> Install Bookmarklet</button>
          <button onClick={() => setImportOpen(true)} className="rs-btn-outline" data-testid="import-listing-btn"><LinkIcon className="w-4 h-4" /> Import from URL</button>
          <button onClick={() => { setImportNotes([]); setEditing({ ...BLANK }); }} className="rs-btn-primary" data-testid="add-property-btn"><Plus className="w-4 h-4" /> Add Property</button>
        </div>
      </div>

      {autoImportBusy && (
        <div className="mb-4 p-3 rounded-lg bg-[#0A192F] text-white text-sm flex items-center gap-2" data-testid="auto-import-loading">
          <Loader2 className="w-4 h-4 animate-spin" /> Importing the page from your bookmarklet…
        </div>
      )}
      {autoImportErr && !autoImportBusy && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm" data-testid="auto-import-error">{autoImportErr}</div>
      )}

      <div className="rs-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="p-4">Title</th><th className="p-4">Location</th><th className="p-4">Rent</th><th className="p-4">Beds/Baths</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t border-slate-100" data-testid={`row-property-${p.id}`}>
                <td className="p-4 font-medium text-[#0A192F]">{p.title}</td>
                <td className="p-4 text-slate-600">{p.city}, {p.state}</td>
                <td className="p-4">{formatMoney(p.rent)}</td>
                <td className="p-4">{p.bedrooms} / {p.bathrooms}</td>
                <td className="p-4"><span className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700">{p.status}</span></td>
                <td className="p-4 text-right">
                  <button onClick={() => setEditing({ ...p })} className="p-1.5 text-slate-500 hover:text-[#0A192F]" data-testid={`edit-${p.id}`}><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(p.id)} className="p-1.5 text-slate-500 hover:text-red-600 ml-1" data-testid={`del-${p.id}`}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-slate-400">No properties yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-[#0A192F]/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="font-display text-xl font-bold text-[#0A192F]">{editing.id ? "Edit Property" : "New Property"}</h2>
              <button onClick={() => { setEditing(null); setImportNotes([]); }}><X className="w-5 h-5" /></button>
            </div>
            {importNotes.length > 0 && (
              <div className="mx-6 mt-5 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm" data-testid="import-notes">
                <div className="font-semibold flex items-center gap-1.5 mb-1"><Sparkles className="w-4 h-4" /> Imported — please review</div>
                <ul className="list-disc ml-5 space-y-0.5">
                  {importNotes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}
            <div className="p-6 grid sm:grid-cols-2 gap-4">
              {[
                ["title", "Title"], ["property_type", "Type", ["Apartment","House","Studio","Condo"]],
                ["address", "Address"], ["city", "City"], ["state", "State"], ["zip_code", "ZIP"],
                ["rent", "Rent", null, "number"], ["deposit", "Deposit", null, "number"], ["application_fee", "Application Fee", null, "number"],
                ["bedrooms", "Bedrooms", null, "number"], ["bathrooms", "Bathrooms", null, "number"], ["square_feet", "Square Feet", null, "number"],
                ["lease_term", "Lease Term"], ["pet_policy", "Pet Policy"], ["parking", "Parking"], ["utilities", "Utilities"],
                ["availability_date", "Available", null, "date"], ["required_income", "Required Income", null, "number"],
                ["owner_name", "Owner Name"], ["broker_name", "Broker / Manager"],
              ].map(([key, label, options, type]) => (
                <div key={key}>
                  <label className="rs-label">{label}</label>
                  {options ? (
                    <select className="rs-input" value={editing[key]} onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}>
                      {options.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={type || "text"} className="rs-input" value={editing[key] || ""} onChange={(e) => setEditing({ ...editing, [key]: e.target.value })} />
                  )}
                </div>
              ))}
              <div className="sm:col-span-2"><label className="rs-label">Description</label><textarea rows={3} className="rs-input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="rs-label">Amenities (comma-separated)</label><input className="rs-input" value={arrToStr(editing.amenities)} onChange={(e) => setEditing({ ...editing, amenities: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="rs-label">Tags (comma-separated)</label><input className="rs-input" value={arrToStr(editing.tags)} onChange={(e) => setEditing({ ...editing, tags: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="rs-label">External Image URLs (optional, comma-separated)</label><input className="rs-input" value={arrToStr(editing.images?.filter?.((x) => typeof x === "string" && !x.startsWith("storage://")) || editing.images)} onChange={(e) => {
                const externals = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                const storedOnly = (editing.images || []).filter((x) => typeof x === "string" && x.startsWith("storage://"));
                setEditing({ ...editing, images: [...storedOnly, ...externals] });
              }} /></div>
              {editing.id ? (
                <div className="sm:col-span-2">
                  <label className="rs-label">Uploaded Images</label>
                  <PropertyImageManager
                    property={editing}
                    onChange={(images) => setEditing({ ...editing, images })}
                  />
                </div>
              ) : (
                <div className="sm:col-span-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  Save the property first to upload images via drag-and-drop. You can also add external image URLs above.
                </div>
              )}
              <div className="sm:col-span-2"><label className="rs-label">Required Documents (one per line)</label><textarea rows={4} className="rs-input" value={Array.isArray(editing.required_documents) ? editing.required_documents.join("\n") : editing.required_documents} onChange={(e) => setEditing({ ...editing, required_documents: e.target.value })} /></div>
              <div><label className="rs-label">Status</label><select className="rs-input" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}><option value="available">Available</option><option value="rented">Rented</option><option value="hidden">Hidden</option><option value="pending">Pending</option></select></div>
              <label className="flex items-center gap-2 mt-7"><input type="checkbox" checked={editing.pet_friendly} onChange={(e) => setEditing({ ...editing, pet_friendly: e.target.checked })} /> Pet Friendly</label>
              <label className="flex items-center gap-2 mt-7"><input type="checkbox" checked={editing.require_ssn} onChange={(e) => setEditing({ ...editing, require_ssn: e.target.checked })} /> Require SSN Document</label>
              <div className="sm:col-span-2"><label className="rs-label">Internal Notes (admin only)</label><textarea rows={2} className="rs-input" value={editing.internal_notes} onChange={(e) => setEditing({ ...editing, internal_notes: e.target.value })} /></div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={() => setEditing(null)} className="rs-btn-outline">Cancel</button>
              <button onClick={save} className="rs-btn-primary" data-testid="save-property">Save</button>
            </div>
          </div>
        </div>
      )}
      {importOpen && (
        <ImportFromUrlModal
          onClose={() => setImportOpen(false)}
          onImported={(prefill, notes) => {
            setImportOpen(false);
            setImportNotes(notes || []);
            setEditing({ ...BLANK, ...prefill });
          }}
        />
      )}
      {bookmarkletOpen && <BookmarkletModal onClose={() => setBookmarkletOpen(false)} />}
    </div>
  );
}

function BookmarkletModal({ onClose }) {
  // Build the bookmarklet JS for THIS site's origin so it always points
  // to the right admin app even when the user moves to a different domain.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const target = `${origin}/admin/properties#bm`;
  const bookmarkletJs = `javascript:(function(){try{var p=JSON.stringify({url:location.href,html:document.documentElement.outerHTML});var n='rs:'+btoa(unescape(encodeURIComponent(p)));window.open('${target}',n);}catch(e){alert('RentSure import failed: '+e.message);}})();`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(bookmarkletJs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A192F]/60 flex items-center justify-center p-4" data-testid="bookmarklet-modal">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-[#0A192F] flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-[#C5A880]" /> One-Click Import Bookmarklet
          </h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600 leading-relaxed">
            Drag the button below to your <strong>bookmarks bar</strong>. After that, while viewing any listing on <strong>Zillow / Realtor / Apartments.com / Trulia / Redfin</strong>,
            just click the bookmarklet — a new tab opens on RentSure and the property auto-imports in ~5 seconds.
          </p>

          <div className="rounded-xl border-2 border-dashed border-[#C5A880] p-6 bg-amber-50/40 text-center">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-3">Drag this button → your bookmarks bar</div>
            <a
              href={bookmarkletJs}
              onClick={(e) => e.preventDefault()}
              draggable="true"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0A192F] text-white font-semibold cursor-move hover:bg-[#112240] transition-colors"
              data-testid="bookmarklet-link"
            >
              <Sparkles className="w-4 h-4 text-[#C5A880]" /> Import to RentSure
            </a>
            <div className="text-[11px] text-slate-500 mt-3">
              Show bookmarks bar first: <code className="px-1 py-0.5 bg-white border border-slate-200 rounded">Ctrl+Shift+B</code> (Chrome / Edge) or <code className="px-1 py-0.5 bg-white border border-slate-200 rounded">⌘+Shift+B</code> (Mac).
            </div>
          </div>

          <details className="rounded-lg border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#0A192F]">Can't drag? Copy the bookmarklet code</summary>
            <div className="mt-3 text-xs text-slate-600 leading-relaxed">
              1. Right-click your bookmarks bar → <strong>Add new bookmark</strong><br />
              2. Name it <code>Import to RentSure</code><br />
              3. Paste the code below into the URL field
            </div>
            <div className="mt-3 relative">
              <textarea readOnly className="rs-input font-mono text-[10px] !pr-12" rows={4} value={bookmarkletJs} onClick={(e) => e.target.select()} />
              <button onClick={copy} className="absolute top-2 right-2 p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700" title="Copy" data-testid="bookmarklet-copy">
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </details>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700">
            <div className="font-semibold text-[#0A192F] mb-1.5 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> How it works</div>
            <ol className="list-decimal ml-5 space-y-1 text-xs">
              <li>You install the bookmarklet once (drag the button above).</li>
              <li>On any listing page, click the bookmarklet from your bookmarks bar.</li>
              <li>A new tab opens to <code>{origin}/admin/properties</code>.</li>
              <li>The page HTML is transferred securely via <code>window.name</code> — no servers, no copying.</li>
              <li>The property edit modal opens auto-filled. You review, fix anything, save.</li>
            </ol>
          </div>

          <div className="text-[11px] text-slate-500 leading-relaxed">
            ⚠️ <strong>Stay signed in:</strong> If you aren't logged into RentSure when you click the bookmarklet, the new tab will redirect to the admin login page. Sign in and click the bookmarklet again on the listing page.
          </div>

          <div className="flex justify-end">
            <button onClick={onClose} className="rs-btn-primary">Got it</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImportFromUrlModal({ onClose, onImported }) {
  const [mode, setMode] = useState("url"); // "url" or "paste"
  const [url, setUrl] = useState("");
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e?.preventDefault();
    setErr("");
    if (mode === "url" && !/^https?:\/\//i.test(url.trim())) {
      setErr("Paste a full URL starting with https://");
      return;
    }
    if (mode === "paste" && html.trim().length < 200) {
      setErr("Pasted content looks too short to be a real page source. Open the listing → right-click → View page source → Select All → Copy → paste here.");
      return;
    }
    setBusy(true);
    try {
      const body = mode === "paste"
        ? { url: url.trim() || undefined, html }
        : { url: url.trim() };
      const r = await api.post("/admin/properties/import-url", body);
      onImported(r.data?.prefill || {}, r.data?.notes || []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Import failed. The site may be blocking automated requests — try the 'Paste page source' tab.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A192F]/60 flex items-center justify-center p-4" data-testid="import-modal">
      <div className="bg-white rounded-2xl max-w-lg w-full">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-[#0A192F] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#C5A880]" /> Import from Listing
          </h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6">
          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            We'll pre-fill the property form from <strong>Zillow</strong>, <strong>Realtor.com</strong>, <strong>Apartments.com</strong>, <strong>Trulia</strong>, <strong>Redfin</strong> or any other listing site. You review and save.
          </p>

          <div className="flex gap-1 border-b border-slate-200 mb-4">
            <button type="button" onClick={() => setMode("url")} className={`px-3 py-2 text-sm font-medium border-b-2 transition ${mode === "url" ? "border-[#C5A880] text-[#0A192F]" : "border-transparent text-slate-500 hover:text-[#0A192F]"}`} data-testid="import-tab-url">
              <LinkIcon className="w-3.5 h-3.5 inline mr-1" /> Fetch by URL
            </button>
            <button type="button" onClick={() => setMode("paste")} className={`px-3 py-2 text-sm font-medium border-b-2 transition ${mode === "paste" ? "border-[#C5A880] text-[#0A192F]" : "border-transparent text-slate-500 hover:text-[#0A192F]"}`} data-testid="import-tab-paste">
              <Sparkles className="w-3.5 h-3.5 inline mr-1" /> Paste page source
            </button>
          </div>

          {mode === "url" ? (
            <>
              <label className="rs-label">Listing URL</label>
              <div className="relative">
                <LinkIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="url"
                  className="rs-input !pl-10"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.zillow.com/homedetails/…"
                  autoFocus
                  data-testid="import-url-input"
                />
              </div>
              <div className="mt-2 text-[11px] text-slate-500 leading-relaxed">
                Many sites (Zillow, Realtor, Trulia) block automated fetches. If you see a fetch error, switch to <strong>Paste page source</strong>.
              </div>
            </>
          ) : (
            <>
              <label className="rs-label">Original URL <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                type="url"
                className="rs-input !pl-3 mb-3"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.zillow.com/…"
                data-testid="import-url-paste"
              />
              <label className="rs-label">Page Source HTML</label>
              <textarea
                rows={8}
                className="rs-input font-mono text-xs"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder="Open the listing in your browser → right-click → 'View Page Source' → Ctrl+A → Ctrl+C → paste here"
                data-testid="import-html-input"
              />
              <div className="mt-2 text-[11px] text-slate-500 leading-relaxed">
                <strong>How to copy:</strong> open the listing → <code className="px-1 py-0.5 bg-slate-100 rounded">Ctrl+U</code> (View Source) → <code className="px-1 py-0.5 bg-slate-100 rounded">Ctrl+A</code> (Select All) → <code className="px-1 py-0.5 bg-slate-100 rounded">Ctrl+C</code> (Copy) → paste here.
              </div>
            </>
          )}

          {err && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2" data-testid="import-error">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{err}</div>
            </div>
          )}

          <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
            <div className="font-semibold text-[#0A192F] mb-1 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> What gets imported</div>
            Title · address · city · state · zip · rent · bedrooms · bathrooms · square feet · cover image(s) · description.
            <div className="mt-1.5 text-slate-500">All fields are editable before saving. Missing fields are flagged for manual entry.</div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rs-btn-outline">Cancel</button>
            <button type="submit" disabled={busy || (mode === "url" ? !url.trim() : !html.trim())} className="rs-btn-primary disabled:opacity-60" data-testid="import-submit">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</> : <>Import</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PropertyImageManager({ property, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const images = property.images || [];

  const uploadFile = async (file) => {
    setErr("");
    if (!file.type.startsWith("image/")) { setErr("Only image files (JPG/PNG/WEBP) are allowed"); return; }
    if (file.size > 8 * 1024 * 1024) { setErr("Max 8MB per image"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/admin/properties/${property.id}/images`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      const r = await api.get(`/admin/properties`);
      const fresh = r.data.find((p) => p.id === property.id);
      if (fresh) onChange(fresh.images || []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Upload failed");
    } finally { setBusy(false); }
  };

  const onFiles = async (files) => {
    for (const f of Array.from(files || [])) {
      // eslint-disable-next-line no-await-in-loop
      await uploadFile(f);
    }
  };

  const removeAt = async (idx) => {
    if (!window.confirm("Delete this image?")) return;
    try {
      const r = await api.delete(`/admin/properties/${property.id}/images/${idx}`);
      onChange(r.data.images || []);
    } catch (e) { setErr(e?.response?.data?.detail || "Delete failed"); }
  };

  const reorder = async (idx, delta) => {
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= images.length) return;
    const order = images.map((_, i) => i);
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    try {
      const r = await api.patch(`/admin/properties/${property.id}/images/reorder`, { order });
      onChange(r.data.images || []);
    } catch (e) { setErr(e?.response?.data?.detail || "Reorder failed"); }
  };

  return (
    <div data-testid="property-image-manager">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition cursor-pointer ${dragOver ? "border-[#C5A880] bg-[#C5A880]/5" : "border-slate-300 hover:border-[#0A192F] bg-slate-50/50"}`}
        onClick={() => inputRef.current?.click()}
        data-testid="image-dropzone"
      >
        {busy ? (
          <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <ImagePlus className="w-7 h-7 text-[#C5A880]" />
            <div className="text-sm"><strong className="text-[#0A192F]">Drop images</strong> or click to browse</div>
            <div className="text-xs text-slate-400">JPG, PNG, WEBP · up to 8 MB each</div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
          data-testid="image-file-input"
        />
      </div>
      {err && <div className="mt-2 text-xs text-red-600" data-testid="image-error">{err}</div>}
      {images.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((ref, i) => (
            <div key={`${ref}-${i}`} className="relative group rs-card overflow-hidden" data-testid={`property-image-${i}`}>
              <div className="aspect-[4/3] bg-slate-100">
                <img
                  src={resolvePropertyImage(property, i)}
                  alt={`Property ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              {i === 0 && <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#C5A880] text-white text-[10px] uppercase tracking-wider font-semibold">Cover</span>}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                <button onClick={(e) => { e.stopPropagation(); reorder(i, -1); }} disabled={i === 0} title="Move up" className="p-1.5 rounded bg-white/90 text-[#0A192F] disabled:opacity-40" data-testid={`img-up-${i}`}><ChevronUp className="w-4 h-4" /></button>
                <button onClick={(e) => { e.stopPropagation(); reorder(i, 1); }} disabled={i === images.length - 1} title="Move down" className="p-1.5 rounded bg-white/90 text-[#0A192F] disabled:opacity-40" data-testid={`img-down-${i}`}><ChevronDown className="w-4 h-4" /></button>
                <button onClick={(e) => { e.stopPropagation(); removeAt(i); }} title="Delete" className="p-1.5 rounded bg-white/90 text-red-600" data-testid={`img-del-${i}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
