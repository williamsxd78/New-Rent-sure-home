import React, { useEffect, useState } from "react";
import { api, formatMoney } from "@/lib/api";
import { Plus, Pencil, Trash2, X } from "lucide-react";

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

  const load = async () => {
    const r = await api.get("/admin/properties");
    setItems(r.data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const payload = { ...editing };
    if (typeof payload.amenities === "string") payload.amenities = payload.amenities.split(",").map((s) => s.trim()).filter(Boolean);
    if (typeof payload.tags === "string") payload.tags = payload.tags.split(",").map((s) => s.trim()).filter(Boolean);
    if (typeof payload.images === "string") payload.images = payload.images.split(",").map((s) => s.trim()).filter(Boolean);
    if (typeof payload.required_documents === "string") payload.required_documents = payload.required_documents.split("\n").map((s) => s.trim()).filter(Boolean);
    payload.rent = Number(payload.rent); payload.deposit = Number(payload.deposit); payload.application_fee = Number(payload.application_fee);
    payload.bedrooms = Number(payload.bedrooms); payload.bathrooms = Number(payload.bathrooms);
    payload.square_feet = Number(payload.square_feet); payload.required_income = Number(payload.required_income);
    if (editing.id) await api.put(`/admin/properties/${editing.id}`, payload);
    else await api.post("/admin/properties", payload);
    setEditing(null); load();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this property?")) return;
    await api.delete(`/admin/properties/${id}`);
    load();
  };

  const arrToStr = (v) => Array.isArray(v) ? v.join(", ") : v;

  return (
    <div className="p-6 lg:p-10" data-testid="admin-properties">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-bold text-[#0A192F]">Properties</h1>
        <button onClick={() => setEditing({ ...BLANK })} className="rs-btn-primary" data-testid="add-property-btn"><Plus className="w-4 h-4" /> Add Property</button>
      </div>

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
              <button onClick={() => setEditing(null)}><X className="w-5 h-5" /></button>
            </div>
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
              <div className="sm:col-span-2"><label className="rs-label">Image URLs (comma-separated)</label><input className="rs-input" value={arrToStr(editing.images)} onChange={(e) => setEditing({ ...editing, images: e.target.value })} /></div>
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
    </div>
  );
}
