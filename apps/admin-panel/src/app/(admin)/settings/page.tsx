"use client";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { apiClient } from "@/lib/api";

interface Setting {
  key: string;
  value: string;
}
interface SettingGroup {
  title: string;
  icon: string;
  keys: string[];
  labels: Record<string, string>;
}

const SETTING_GROUPS: SettingGroup[] = [
  {
    title: "General",
    icon: "⚙️",
    keys: [
      "currency_symbol",
      "currency_code",
      "app_name",
      "support_email",
      "support_phone",
    ],
    labels: {
      currency_symbol: "Currency Symbol",
      currency_code: "Currency Code",
      app_name: "App Name",
      support_email: "Support Email",
      support_phone: "Support Phone",
    },
  },
  {
    title: "Payment Gateways",
    icon: "💳",
    keys: [
      "razorpay_key_id",
      "razorpay_secret",
      "stripe_key",
      "flutterwave_public_key",
    ],
    labels: {
      razorpay_key_id: "Razorpay Key ID",
      razorpay_secret: "Razorpay Secret",
      stripe_key: "Stripe Secret Key",
      flutterwave_public_key: "Flutterwave Public Key",
    },
  },
  {
    title: "Commission & Payments",
    icon: "📊",
    keys: [
      "admin_commission_percent",
      "min_withdrawal_amount",
      "min_topup",
      "referral_bonus_amount",
    ],
    labels: {
      admin_commission_percent: "Admin Commission (%)",
      min_withdrawal_amount: "Min Withdrawal Amount (₦)",
      min_topup: "Min Wallet Top-up (₦)",
      referral_bonus_amount:
        "Referral Bonus (₦) — paid when a referred patient pays for their first appointment",
    },
  },
  {
    title: "Appointments & Pricing",
    icon: "🕑",
    keys: [
      "night_window_start",
      "night_window_end",
      "cancellation_cutoff_hours",
      "instant_connect_timeout_min",
    ],
    labels: {
      night_window_start: "Night Rate Starts (HH:MM)",
      night_window_end: "Night Rate Ends (HH:MM)",
      cancellation_cutoff_hours: "Free Cancellation Cutoff (hours)",
      instant_connect_timeout_min: "Instant Connect Timeout (min)",
    },
  },
  {
    title: "Notifications",
    icon: "🔔",
    keys: ["otp_expiry_minutes", "appointment_reminder_hours"],
    labels: {
      otp_expiry_minutes: "OTP Expiry (minutes)",
      appointment_reminder_hours: "Appointment Reminder (hours before)",
    },
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get("/admin/settings")
      .then((r: unknown) => {
        const arr = (r as { data: Setting[] }).data ?? [];
        const map: Record<string, string> = {};
        arr.forEach((s) => {
          map[s.key] = s.value;
        });
        setSettings(map);
      })
      .catch(() => {});
  }, []);

  const handleSave = async (keys: string[]) => {
    setSaving(keys[0] ?? null);
    try {
      await Promise.all(
        keys.map((k) =>
          apiClient.patch("/admin/settings", {
            key: k,
            value: settings[k] ?? "",
          }),
        ),
      );
      setSavedMsg("Settings saved!");
      setTimeout(() => setSavedMsg(null), 2000);
    } catch {
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="page-title">Settings</h1>
      {savedMsg && (
        <div className="rounded-xl border border-success-100 bg-success-50 px-4 py-3 text-body-md font-medium text-success-600 animate-fade-in">
          {savedMsg}
        </div>
      )}

      {SETTING_GROUPS.map((group) => (
        <div key={group.title} className="card space-y-4">
          <h2 className="section-title flex items-center gap-2">
            <span>{group.icon}</span>
            {group.title}
          </h2>
          {group.keys.map((k) => (
            <div key={k}>
              <label className="label">{group.labels[k] || k}</label>
              <input
                className="input"
                value={settings[k] ?? ""}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, [k]: e.target.value }))
                }
                placeholder={`Enter ${group.labels[k] || k}`}
              />
            </div>
          ))}
          <button
            onClick={() => handleSave(group.keys)}
            disabled={saving === group.keys[0]}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={15} />
            {saving === group.keys[0]
              ? "Saving..."
              : `Save ${group.title} Settings`}
          </button>
        </div>
      ))}
    </div>
  );
}
