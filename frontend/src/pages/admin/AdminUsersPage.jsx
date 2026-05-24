import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { UserPlus, Trash2, ShieldCheck, AlertCircle, CheckCircle2, X, ToggleLeft, ToggleRight, KeyRound } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "super_admin", label: "Super Admin", desc: "Full access, can manage users & sensitive data" },
  { value: "manager", label: "Manager", desc: "Can review & decide applications" },
  { value: "document_reviewer", label: "Document Reviewer", desc: "Reviews uploaded documents only" },
  { value: "support", label: "Support", desc: "Read-only access for customer support" },
];

const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [pwUser, setPwUser] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const isSuper = me?.role === "super_admin";

  const load = async () => {
    setErrMsg(""); setLoading(true);
    try {
      const r = await api.get("/admin/users");
      setUsers(r.data);
    } catch (e) {
      setErrMsg(e?.response?.data?.detail || "Failed to load admin users");
    } finally { setLoading(false); }
  };

  useEffect(() => { if (isSuper) load(); else setLoading(false); }, [isSuper]);

  const flash = (msg) => { setOkMsg(msg); setTimeout(() => setOkMsg(""), 3500); };

  const updateUser = async (id, patch, msg) => {
    setErrMsg("");
    try {
      await api.patch(`/admin/users/${id}`, patch);
      flash(msg || "Updated");
      load();
    } catch (e) {
      setErrMsg(e?.response?.data?.detail || "Update failed");
    }
  };

  const deleteUser = async (id) => {
    setErrMsg("");
    try {
      await api.delete(`/admin/users/${id}`);
      setConfirmDelete(null);
      flash("User removed");
      load();
    } catch (e) {
      setErrMsg(e?.response?.data?.detail || "Delete failed");
    }
  };

  if (!isSuper) {
    return (
      <div className="p-6 lg:p-10 max-w-2xl">
        <div className="rs-card p-7 text-center">
          <ShieldCheck className="w-12 h-12 text-[#C5A880] mx-auto mb-3" />
          <h1 className="font-display text-xl font-bold text-[#0A192F]">Super Admin access required</h1>
          <p className="text-sm text-slate-600 mt-2">User management is restricted to super admins. Contact your administrator if you need elevated access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10" data-testid="admin-users-page">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#0A192F]">Admin Users</h1>
          <p className="text-sm text-slate-500 mt-1">Create restricted admin accounts and manage roles.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="rs-btn-primary" data-testid="create-admin-btn">
          <UserPlus className="w-4 h-4" /> New Admin
        </button>
      </div>

      {okMsg && <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2" data-testid="users-success"><CheckCircle2 className="w-4 h-4" /> {okMsg}</div>}
      {errMsg && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2" data-testid="users-error"><AlertCircle className="w-4 h-4" /> {errMsg}</div>}

      <div className="rs-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 text-left">
            <tr>
              <th className="p-4">Name</th>
              <th className="p-4">Email</th>
              <th className="p-4">Role</th>
              <th className="p-4">Status</th>
              <th className="p-4">Added</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="p-10 text-center text-slate-400">Loading…</td></tr>}
            {!loading && users.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-slate-400">No admin users yet.</td></tr>}
            {users.map((u) => {
              const isMe = u.id === me?.id;
              const active = u.active !== false;
              return (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`user-row-${u.id}`}>
                  <td className="p-4 font-medium text-[#0A192F]">
                    {u.name} {isMe && <span className="ml-2 text-[10px] uppercase tracking-wider text-[#C5A880]">(you)</span>}
                  </td>
                  <td className="p-4 text-slate-600">{u.email}</td>
                  <td className="p-4">
                    <select
                      className="rs-input !py-1.5 !w-auto text-xs"
                      value={u.role}
                      disabled={isMe}
                      onChange={(e) => updateUser(u.id, { role: e.target.value }, "Role updated")}
                      data-testid={`role-select-${u.id}`}
                    >
                      {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-slate-500">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                  <td className="p-4 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        onClick={() => setPwUser(u)}
                        title="Reset password"
                        className="p-1.5 rounded text-slate-500 hover:text-[#0A192F] hover:bg-slate-100"
                        data-testid={`reset-pw-${u.id}`}
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateUser(u.id, { active: !active }, active ? "Account disabled" : "Account enabled")}
                        disabled={isMe}
                        title={active ? "Deactivate" : "Activate"}
                        className="p-1.5 rounded text-slate-500 hover:text-[#0A192F] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        data-testid={`toggle-active-${u.id}`}
                      >
                        {active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(u)}
                        disabled={isMe}
                        title="Delete admin"
                        className="p-1.5 rounded text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        data-testid={`delete-${u.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); flash("Admin user created"); load(); }}
          onError={setErrMsg}
        />
      )}

      {pwUser && (
        <ResetPasswordModal
          user={pwUser}
          onClose={() => setPwUser(null)}
          onDone={() => { setPwUser(null); flash("Password reset successfully"); }}
          onError={setErrMsg}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Remove ${confirmDelete.name}?`}
          message={`This will permanently revoke ${confirmDelete.email}'s access. This action cannot be undone.`}
          confirmLabel="Remove Admin"
          danger
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteUser(confirmDelete.id)}
        />
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated, onError }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "manager" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/admin/users", form);
      onCreated();
    } catch (err) {
      onError(err?.response?.data?.detail || "Failed to create");
    } finally { setBusy(false); }
  };
  return (
    <Modal title="New Admin User" onClose={onClose} testid="create-user-modal">
      <form onSubmit={submit} className="space-y-3" data-testid="create-user-form">
        <div>
          <label className="rs-label">Full name</label>
          <input className="rs-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="cu-name" />
        </div>
        <div>
          <label className="rs-label">Email</label>
          <input type="email" className="rs-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })} required data-testid="cu-email" />
        </div>
        <div>
          <label className="rs-label">Temporary password (min 8 chars)</label>
          <input type="text" className="rs-input font-mono" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required data-testid="cu-password" />
          <p className="text-xs text-slate-500 mt-1">Share securely. Ask the new admin to change it on first login.</p>
        </div>
        <div>
          <label className="rs-label">Role</label>
          <div className="space-y-2">
            {ROLE_OPTIONS.map((r) => (
              <label key={r.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${form.role === r.value ? "border-[#0A192F] bg-slate-50" : "border-slate-200 hover:bg-slate-50"}`}>
                <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={() => setForm({ ...form, role: r.value })} className="mt-1" data-testid={`cu-role-${r.value}`} />
                <div>
                  <div className="text-sm font-medium text-[#0A192F]">{r.label}</div>
                  <div className="text-xs text-slate-500">{r.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rs-btn-outline">Cancel</button>
          <button type="submit" disabled={busy} className="rs-btn-primary disabled:opacity-50" data-testid="cu-submit">
            {busy ? "Creating…" : "Create Admin"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose, onDone, onError }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/admin/users/${user.id}`, { password: pw });
      onDone();
    } catch (err) {
      onError(err?.response?.data?.detail || "Failed to reset password");
    } finally { setBusy(false); }
  };
  return (
    <Modal title={`Reset password — ${user.name}`} onClose={onClose} testid="reset-pw-modal">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-600">Set a new temporary password for <strong className="text-[#0A192F]">{user.email}</strong>. They'll use it on their next login.</p>
        <input type="text" className="rs-input font-mono" placeholder="New password (min 8 chars)" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required data-testid="reset-pw-input" />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rs-btn-outline">Cancel</button>
          <button type="submit" disabled={busy} className="rs-btn-primary disabled:opacity-50" data-testid="reset-pw-submit">
            {busy ? "Saving…" : "Reset Password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmModal({ title, message, confirmLabel, danger, onCancel, onConfirm }) {
  return (
    <Modal title={title} onClose={onCancel} testid="confirm-modal">
      <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onCancel} className="rs-btn-outline">Cancel</button>
        <button onClick={onConfirm} className={danger ? "rs-btn-primary bg-red-600 border-red-600 hover:bg-red-700" : "rs-btn-primary"} data-testid="confirm-yes">
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose, testid }) {
  return (
    <div className="fixed inset-0 z-50 bg-[#0A192F]/60 flex items-center justify-center p-4" data-testid={testid}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-[#0A192F]">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-[#0A192F]"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export { ROLE_LABEL };
