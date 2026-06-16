"use client";
import { TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

/**
 * Admin modal. Rendered through a portal to <body> so it can never be trapped
 * inside a page's stacking context (transformed `animate-fade-up` wrappers used
 * to pin the curtain to the content area and let the sticky navbar paint over
 * the close button). Clicking the curtain or pressing Escape closes it — but if
 * the user has typed anything inside, an in-modal "unsaved changes" warning
 * asks first. Successful saves (parent flips `open` to false) bypass the guard.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => setMounted(true), []);

  // Fresh slate each time the modal opens.
  useEffect(() => {
    if (open) {
      setDirty(false);
      dirtyRef.current = false;
      setConfirmDiscard(false);
    }
  }, [open]);

  const markDirty = () => {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setDirty(true);
    }
  };

  const requestClose = () => {
    if (dirtyRef.current) setConfirmDiscard(true);
    else onClose();
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (dirtyRef.current) setConfirmDiscard(true);
        else onClose();
      }
    };
    document.addEventListener("keydown", handler);
    // Lock background scroll while the modal is up.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Curtain — fills the real viewport and closes on click */}
      <div
        className="absolute inset-0 bg-navy-deep/45 backdrop-blur-md animate-fade-in"
        onClick={requestClose}
      />
      <div
        className={`relative w-full ${maxWidth} max-h-[90vh] flex flex-col bg-surface rounded-3xl shadow-floating border border-white/60 animate-scale-in overflow-hidden`}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-hairline flex-shrink-0">
          <h3 className="text-heading-sm font-bold text-ink">{title}</h3>
          <button
            onClick={requestClose}
            className="grid place-items-center w-9 h-9 rounded-xl text-gray-400 hover:bg-surfaceAlt hover:text-ink transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {/* Any typing/selection inside marks the form dirty (events bubble). */}
        <div
          className="px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto"
          onInput={markDirty}
          onChangeCapture={markDirty}
        >
          {children}
        </div>

        {/* In-modal unsaved-changes warning (never a browser alert) */}
        {confirmDiscard && dirty && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/80 backdrop-blur-sm animate-fade-in p-6">
            <div className="w-full max-w-sm rounded-2xl border border-hairline bg-surface shadow-floating p-5 text-center">
              <div className="mx-auto grid place-items-center w-11 h-11 rounded-2xl bg-caution-500/15 text-caution-600 mb-3">
                <TriangleAlert size={20} />
              </div>
              <p className="font-bold text-ink">Discard unsaved changes?</p>
              <p className="mt-1 text-sm text-gray-500">
                You've entered details that haven't been saved. Closing now will
                lose them.
              </p>
              <div className="mt-4 flex gap-2.5">
                <button
                  onClick={() => setConfirmDiscard(false)}
                  className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold text-ink hover:bg-surfaceAlt transition-colors"
                >
                  Keep editing
                </button>
                <button
                  onClick={() => {
                    setConfirmDiscard(false);
                    onClose();
                  }}
                  className="flex-1 h-10 rounded-xl bg-alert-500 text-white text-sm font-semibold hover:bg-alert-600 transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
