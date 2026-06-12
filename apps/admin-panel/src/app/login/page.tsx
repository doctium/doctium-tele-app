"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldCheck, ArrowRight } from "lucide-react";
import { apiClient } from "@/lib/api";
import { setToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleLogin = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.email || !form.password) {
      setError("All fields are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = (await apiClient.post("/auth/admin/login", form)) as {
        data: { accessToken: string };
      };
      setToken(res.data.accessToken);
      router.push("/dashboard");
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { label: "Doctors", sub: "Verify & manage" },
    { label: "Patients", sub: "Track activity" },
    { label: "Appointments", sub: "Live schedule" },
    { label: "Earnings", sub: "Revenue insights" },
  ];

  return (
    <div className="min-h-screen w-full bg-muted flex items-center justify-center p-4 lg:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[34px] bg-surface shadow-floating border border-white/60 lg:grid-cols-2 animate-scale-in">
        {/* ── Brand panel ─────────────────────────────────────── */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-hero p-10 text-white lg:flex">
          <div className="pointer-events-none absolute inset-0 hero-sheen" />
          <div className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-teal-bright/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-12 h-72 w-72 rounded-full bg-skyblue/15 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="grid place-items-center w-11 h-11 rounded-2xl bg-white shadow-cta overflow-hidden p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/doctium-logo-lightbg.png"
                  alt="Doctium"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <p className="text-[17px] font-extrabold leading-none tracking-tight">
                  Doctium
                </p>
                <p className="mt-1 text-[11px] tracking-wide text-skyblue-200/70">
                  Admin Console
                </p>
              </div>
            </div>

            <h2 className="mt-12 text-display-md font-extrabold leading-tight tracking-tight">
              Run your platform
              <br />
              with clinical precision.
            </h2>
            <p className="mt-3 max-w-sm text-body-md text-skyblue-100/80">
              Doctors, patients, appointments, and earnings — orchestrated from
              one calm, powerful command center.
            </p>
          </div>

          <div className="relative mt-10 grid grid-cols-2 gap-3">
            {features.map((f) => (
              <div
                key={f.label}
                className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10 backdrop-blur-sm"
              >
                <p className="text-body-md font-bold">{f.label}</p>
                <p className="mt-0.5 text-caption text-skyblue-200/70">
                  {f.sub}
                </p>
              </div>
            ))}
          </div>

          <div className="relative mt-8 flex items-center gap-2 text-caption text-skyblue-200/70">
            <ShieldCheck size={15} className="text-teal-bright" />
            Encrypted & access-controlled console
          </div>
        </div>

        {/* ── Form panel ──────────────────────────────────────── */}
        <div className="flex flex-col justify-center p-8 sm:p-12">
          {/* mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid place-items-center w-11 h-11 rounded-2xl bg-white shadow-card ring-1 ring-gray-100 overflow-hidden p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/doctium-logo-lightbg.png"
                alt="Doctium"
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-[17px] font-extrabold text-ink">Doctium Admin</p>
          </div>

          <div className="mb-8">
            <p className="eyebrow">Welcome back</p>
            <h1 className="mt-1 text-heading-lg font-extrabold text-ink">
              Sign in to your console
            </h1>
            <p className="mt-1.5 text-body-md text-gray-500">
              Enter your credentials to continue.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-alert-100 bg-alert-50 px-4 py-3 text-body-md font-medium text-alert-600 animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="admin@doctium.com"
                className="input"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  placeholder="Enter your password"
                  className="input pr-11"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-ink"
                >
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-body-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Sign In <ArrowRight size={18} />
                </span>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-caption text-gray-400">
            © {new Date().getFullYear()} Doctium · Secure admin access
          </p>
        </div>
      </div>
    </div>
  );
}
