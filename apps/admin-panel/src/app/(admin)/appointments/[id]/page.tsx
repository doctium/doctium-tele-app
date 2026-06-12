"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck,
  Sparkles,
  Stethoscope,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { apiClient } from "@/lib/api";
import { formatMoney } from "@/lib/money";

interface Detail {
  id: string;
  appointmentId?: string;
  bookingNumber?: number;
  date: string;
  time: string;
  status: string;
  paymentStatus: string;
  paymentGateway?: string;
  type?: string;
  mode?: string;
  amount: number;
  discount: number;
  memberDiscount: number;
  creditApplied: boolean;
  adminCommissionPercent: number;
  adminEarning: number;
  doctorEarning: number;
  couponCode?: string | null;
  details?: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    image: string;
    mobile: string;
    email: string;
  } | null;
  doctor: {
    id: string;
    name: string;
    image: string;
    designation: string;
  } | null;
  service: { name: string } | null;
  subPatient: { name: string } | null;
}
interface Triage {
  urgency: string;
  summary: string;
  reasons: string[];
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-orange-50 text-orange-600 ring-orange-500/20",
  CONFIRMED: "bg-skyblue-50 text-navy-mid ring-skyblue/30",
  COMPLETED: "bg-teal-50 text-teal-600 ring-teal-500/20",
  CANCELLED: "bg-red-50 text-red-600 ring-red-500/20",
};

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [appt, setAppt] = useState<Detail | null>(null);
  const [triage, setTriage] = useState<Triage | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiClient
      .get(`/admin/appointments/${id}`)
      .then((r) => setAppt((r as { data: Detail }).data))
      .catch(() => setNotFound(true));
    // Leenah intake (admin is a permitted party); 404 = patient didn't use her
    apiClient
      .get(`/triage/appointments/${id}`)
      .then((r) => setTriage((r as { data: Triage }).data))
      .catch(() => {});
  }, [id]);

  if (notFound)
    return (
      <div className="card mx-auto max-w-lg text-center text-gray-500">
        Appointment not found.
      </div>
    );
  if (!appt)
    return (
      <div className="card mx-auto max-w-lg text-center text-gray-400">
        Loading…
      </div>
    );

  const moneyRows = [
    { label: "Patient paid", value: formatMoney(appt.amount), strong: true },
    ...(appt.discount > 0
      ? [
          {
            label: `Coupon discount${appt.couponCode ? ` (${appt.couponCode})` : ""}`,
            value: `− ${formatMoney(appt.discount)}`,
          },
        ]
      : []),
    ...(appt.memberDiscount > 0
      ? [
          {
            label: "DoctiumPlus member discount",
            value: `− ${formatMoney(appt.memberDiscount)}`,
          },
        ]
      : []),
    ...(appt.creditApplied
      ? [{ label: "Plan credit applied", value: "1 consult credit" }]
      : []),
    {
      label: `Platform commission (${appt.adminCommissionPercent}%)`,
      value: formatMoney(appt.adminEarning),
    },
    {
      label: "Doctor's earning",
      value: formatMoney(appt.doctorEarning),
      teal: true,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-body-sm font-semibold text-gray-500 transition hover:text-ink"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* ── Header ── */}
      <div className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-navy text-white">
              <CalendarCheck size={20} />
            </div>
            <div>
              <p className="eyebrow">
                Booking{appt.bookingNumber ? ` #${appt.bookingNumber}` : ""}
              </p>
              <h1 className="section-title">
                {appt.date} · {appt.time}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1.5 text-micro font-bold ring-1 ring-inset ${STATUS_STYLE[appt.status] ?? "bg-gray-50 text-gray-600 ring-gray-300"}`}
            >
              {appt.status}
            </span>
            <span className="inline-flex rounded-full bg-gray-50 px-3 py-1.5 text-micro font-bold text-gray-600 ring-1 ring-inset ring-gray-200">
              {appt.paymentStatus}
              {appt.paymentGateway ? ` · ${appt.paymentGateway}` : ""}
            </span>
          </div>
        </div>
        {appt.service?.name || appt.subPatient?.name || appt.details ? (
          <p className="mt-3 text-body-sm text-gray-500">
            {appt.service?.name ? `${appt.service.name}` : "Consultation"}
            {appt.subPatient?.name
              ? ` · for ${appt.subPatient.name} (family)`
              : ""}
            {appt.details ? ` — "${appt.details}"` : ""}
          </p>
        ) : null}
      </div>

      {/* ── Parties ── */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Link
          href={appt.user ? `/users/${appt.user.id}` : "#"}
          className="card card-hover"
        >
          <div className="flex items-center gap-3">
            <Avatar src={appt.user?.image} name={appt.user?.name} size={44} />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-caption font-bold uppercase tracking-wide text-gray-400">
                <UserIcon size={12} /> Patient
              </p>
              <p className="truncate font-semibold text-ink">
                {appt.user?.name ?? "—"}
              </p>
              <p className="truncate text-caption text-gray-400">
                {appt.user?.mobile || appt.user?.email}
              </p>
            </div>
          </div>
        </Link>
        <Link
          href={appt.doctor ? `/doctors/${appt.doctor.id}` : "#"}
          className="card card-hover"
        >
          <div className="flex items-center gap-3">
            <Avatar
              src={appt.doctor?.image}
              name={appt.doctor?.name}
              size={44}
            />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-caption font-bold uppercase tracking-wide text-gray-400">
                <Stethoscope size={12} /> Doctor
              </p>
              <p className="truncate font-semibold text-ink">
                Dr. {appt.doctor?.name ?? "—"}
              </p>
              <p className="truncate text-caption text-gray-400">
                {appt.doctor?.designation || "General practice"}
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* ── Money ── */}
      <div className="card">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-teal text-white">
            <Wallet size={16} />
          </div>
          <h2 className="section-title">Payment breakdown</h2>
        </div>
        <div className="space-y-2.5">
          {moneyRows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between border-b border-gray-50 pb-2.5"
            >
              <span className="text-body-sm text-gray-600">{r.label}</span>
              <span
                className={`tabular-nums ${r.strong ? "font-extrabold text-ink" : r.teal ? "font-bold text-teal-600" : "font-semibold text-gray-700"}`}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Leenah intake (when the patient used the symptom checker) ── */}
      {triage ? (
        <div className="card">
          <div className="mb-3 flex items-center gap-2.5">
            <Sparkles size={16} className="text-teal-500" />
            <h2 className="section-title">Leenah intake summary</h2>
            <span className="ml-auto inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-micro font-bold text-teal-600 ring-1 ring-inset ring-teal-500/20">
              {triage.urgency.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-body-sm leading-relaxed text-gray-600">
            {triage.summary}
          </p>
        </div>
      ) : null}
    </div>
  );
}
