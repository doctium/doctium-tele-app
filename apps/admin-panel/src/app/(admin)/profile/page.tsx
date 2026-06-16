"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Save } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { apiClient } from "@/lib/api";
import { useAdminAuth } from "@/lib/auth-context";
import { toast } from "@/lib/toast";

interface AdminProfile {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export default function ProfilePage() {
  const { refresh } = useAdminAuth();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [form, setForm] = useState({ name: "", email: "", image: "" });
  const [pwdForm, setPwdForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  // Camera button → pick an image → upload as a data-URL → saved immediately.
  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Image must be under 3MB");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setUploading(true);
    try {
      const r = (await apiClient.patch("/admin/profile", {
        image: dataUrl,
      })) as { data: AdminProfile };
      const saved = r.data?.image ?? dataUrl;
      setForm((f) => ({ ...f, image: saved }));
      setProfile((p) => (p ? { ...p, image: saved } : p));
      refresh(); // top-right ProfileMenu avatar updates live
      toast.success("Profile picture updated");
    } catch {
      toast.error("Could not upload the picture");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    apiClient
      .get("/admin/profile")
      .then((r: unknown) => {
        const p = (r as { data: AdminProfile }).data;
        setProfile(p);
        setForm({ name: p.name, email: p.email, image: p.image ?? "" });
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg("");
    try {
      await apiClient.patch("/admin/profile", form);
      setMsg("Profile updated successfully!");
    } catch {
      setMsg("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePwdChange = async () => {
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdMsg("Passwords do not match");
      return;
    }
    setSavingPwd(true);
    setPwdMsg("");
    try {
      await apiClient.put("/admin/password", pwdForm);
      setPwdMsg("Password changed successfully!");
      setPwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      setPwdMsg("Failed to change password");
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="page-title">Admin Profile</h1>

      {/* Profile card */}
      <div className="card space-y-5">
        <div className="flex items-center gap-5">
          <div className="relative">
            <Avatar src={form.image} name={form.name} size={80} />
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePickImage}
            />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              title="Change profile picture"
              className="absolute bottom-0 right-0 w-7 h-7 bg-primary-500 rounded-full flex items-center justify-center text-white transition hover:scale-110 disabled:opacity-60"
            >
              {uploading ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <Camera size={13} />
              )}
            </button>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {profile?.name ?? "Admin"}
            </h2>
            <p className="text-gray-400 text-sm">{profile?.email}</p>
          </div>
        </div>

        {msg && (
          <p
            className={`text-sm font-medium p-3 rounded-xl ${msg.includes("success") ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}
          >
            {msg}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Full Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
            />
          </div>
          <div className="col-span-2">
            <label className="label">Profile Image URL</label>
            <input
              className="input"
              value={form.image}
              onChange={(e) =>
                setForm((f) => ({ ...f, image: e.target.value }))
              }
              placeholder="https://..."
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          <Save size={16} /> {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Password card */}
      <div className="card space-y-4">
        <h2 className="section-title">Change Password</h2>

        {pwdMsg && (
          <p
            className={`text-sm font-medium p-3 rounded-xl ${pwdMsg.includes("success") ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}
          >
            {pwdMsg}
          </p>
        )}

        {(["oldPassword", "newPassword", "confirmPassword"] as const).map(
          (k) => (
            <div key={k}>
              <label className="label">
                {k === "oldPassword"
                  ? "Current Password"
                  : k === "newPassword"
                    ? "New Password"
                    : "Confirm New Password"}
              </label>
              <input
                type="password"
                className="input"
                value={pwdForm[k]}
                onChange={(e) =>
                  setPwdForm((f) => ({ ...f, [k]: e.target.value }))
                }
                placeholder="••••••••"
              />
            </div>
          ),
        )}

        <button
          onClick={handlePwdChange}
          disabled={savingPwd}
          className="btn-outline flex items-center gap-2"
        >
          {savingPwd ? "Updating..." : "Update Password"}
        </button>
      </div>
    </div>
  );
}
