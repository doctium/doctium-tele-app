"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, X } from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { apiClient } from "./api";
import { useAdminAuth } from "./auth-context";
import { formatMoney } from "./money";
import { toast } from "./toast";

export interface BookingAlert {
  id: string;
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
  amount: number;
  status: string;
}

export interface SupportMessage {
  id: string;
  threadId: string;
  sender: "USER" | "ADMIN";
  senderName: string;
  type: "TEXT" | "IMAGE" | "AUDIO";
  body: string;
  mediaUrl: string;
  durationSec?: number | null;
  read: boolean;
  createdAt: string;
}

type Listener = (msg: SupportMessage, userId: string) => void;

interface SupportCtx {
  unread: number;
  setUnread: React.Dispatch<React.SetStateAction<number>>;
  refreshUnread: () => void;
  onMessage: (cb: Listener) => () => void;
}

const Ctx = createContext<SupportCtx>({
  unread: 0,
  setUnread: () => {},
  refreshUnread: () => {},
  onMessage: () => () => {},
});

function beep() {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctor();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    o.start();
    o.stop(ctx.currentTime + 0.32);
    o.onended = () => ctx.close();
  } catch {
    /* autoplay blocked until a user gesture — fine */
  }
}

/** Three-tone rising alarm for new bookings — more insistent than the chat beep. */
function alarm() {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctor();
    const tones = [659, 784, 988]; // E5 → G5 → B5
    tones.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "triangle";
      o.frequency.value = freq;
      const t = ctx.currentTime + i * 0.28;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.start(t);
      o.stop(t + 0.28);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* autoplay blocked until a user gesture — fine */
  }
}

export function SupportProvider({ children }: { children: React.ReactNode }) {
  const [unread, setUnread] = useState(0);
  const [bookingAlert, setBookingAlert] = useState<BookingAlert | null>(null);
  const listeners = useRef<Set<Listener>>(new Set());
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();
  const { me } = useAdminAuth();

  const refreshUnread = useCallback(() => {
    (
      apiClient.get("/admin/support/unread-count") as Promise<{
        data: { count: number };
      }>
    )
      .then((r) => setUnread(r.data?.count ?? 0))
      .catch(() => {});
  }, []);

  const onMessage = useCallback((cb: Listener) => {
    listeners.current.add(cb);
    return () => {
      listeners.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    if (!me) return; // only connect once the admin session is established

    refreshUnread();

    const api =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
    const origin = api.replace(/\/api\/v1\/?$/, "");
    // Authenticate the socket with the httpOnly admin cookie (no JS-readable token).
    const socket = io(`${origin}/support`, {
      withCredentials: true,
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on(
      "support:newMessage",
      ({ message, userId }: { message: SupportMessage; userId: string }) => {
        if (message.sender === "USER") {
          setUnread((u) => u + 1);
          const preview =
            message.type === "IMAGE"
              ? "📷 Photo"
              : message.type === "AUDIO"
                ? "🎤 Voice note"
                : message.body;
          toast.info(`New support message: ${preview}`.slice(0, 90));
          beep();
        }
        listeners.current.forEach((cb) => cb(message, userId));
      },
    );

    // "There's a New Patient Booking" — popup + alarm on every admin session.
    socket.on("booking:new", (booking: BookingAlert) => {
      setBookingAlert(booking);
      alarm();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [me, refreshUnread]);

  const checkItOut = () => {
    if (!bookingAlert) return;
    const id = bookingAlert.id;
    setBookingAlert(null);
    router.push(`/appointments/${id}`);
  };

  return (
    <Ctx.Provider value={{ unread, setUnread, refreshUnread, onMessage }}>
      {children}

      {/* ── New-booking alert popup ── */}
      {bookingAlert ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-surface p-7 shadow-floating animate-fade-up">
            <div className="flex items-start justify-between">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-teal text-white shadow-cta-navy">
                <CalendarPlus size={22} />
              </div>
              <button
                onClick={() => setBookingAlert(null)}
                className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Dismiss"
              >
                <X size={18} />
              </button>
            </div>
            <h2 className="mt-4 text-heading-lg font-extrabold text-ink">
              There&apos;s a New Patient Booking
            </h2>
            <p className="mt-2 text-body-md text-gray-600">
              <span className="font-semibold text-ink">
                {bookingAlert.patientName}
              </span>{" "}
              booked{" "}
              <span className="font-semibold text-ink">
                Dr. {bookingAlert.doctorName}
              </span>{" "}
              for {bookingAlert.date} at {bookingAlert.time}
              {bookingAlert.amount > 0
                ? ` · ${formatMoney(bookingAlert.amount)}`
                : ""}
              .
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={checkItOut} className="btn-primary flex-1">
                Check it out
              </button>
              <button
                onClick={() => setBookingAlert(null)}
                className="btn-outline"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

export const useSupport = () => useContext(Ctx);
