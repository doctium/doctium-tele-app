"use client";
import { useState } from "react";
import clsx from "clsx";

/** Escapes HTML, then renders a safe subset of Markdown for the admin preview.
 *  (The website renders the full Markdown with react-markdown; this is just a
 *  convenience preview for editors, so it stays minimal and injection-safe.) */
function renderPreview(md: string): string {
  const esc = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = esc.split("\n");
  const html: string[] = [];
  let inList = false;
  const inline = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, '<code class="px-1 rounded bg-surfaceAlt">$1</code>')
      .replace(
        /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" class="text-navy underline" target="_blank" rel="noopener noreferrer">$1</a>',
      );

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^### /.test(line)) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(
        `<h3 class="font-bold text-ink mt-3">${inline(line.slice(4))}</h3>`,
      );
    } else if (/^## /.test(line)) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(
        `<h2 class="font-bold text-ink text-lg mt-4">${inline(line.slice(3))}</h2>`,
      );
    } else if (/^# /.test(line)) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(
        `<h1 class="font-bold text-ink text-xl mt-4">${inline(line.slice(2))}</h1>`,
      );
    } else if (/^[-*] /.test(line)) {
      if (!inList) {
        html.push('<ul class="list-disc pl-5 space-y-1">');
        inList = true;
      }
      html.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (line === "") {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push("<div class='h-2'></div>");
    } else {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<p>${inline(line)}</p>`);
    }
  }
  if (inList) html.push("</ul>");
  return html.join("");
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 12,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");

  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <div className="flex items-center gap-1 border-b border-hairline bg-surfaceAlt/60 px-2 py-1.5">
        {(["write", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={clsx(
              "px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors",
              tab === t
                ? "bg-surface text-ink shadow-sm"
                : "text-gray-500 hover:text-ink",
            )}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto pr-1 text-[11px] text-gray-400">
          Markdown supported
        </span>
      </div>
      {tab === "write" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            placeholder ??
            "Write in Markdown… # Heading, **bold**, - list, [link](https://…)"
          }
          rows={rows}
          className="w-full resize-y border-0 bg-surface px-4 py-3 text-body-md text-ink focus:outline-none focus:ring-0 font-mono"
        />
      ) : (
        <div
          className="prose-preview min-h-[12rem] px-4 py-3 text-body-md text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: value.trim()
              ? renderPreview(value)
              : "<p class='text-gray-400'>Nothing to preview yet.</p>",
          }}
        />
      )}
    </div>
  );
}
