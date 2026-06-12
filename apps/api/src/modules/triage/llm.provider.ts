import { Injectable, Logger } from "@nestjs/common";

export interface TriageVerdict {
  urgency: string;
  specialty: string;
  reasons: string[];
  selfCare: string[];
  summary: string;
}
export interface TriageTurn {
  action: "ask" | "verdict";
  question: string | null;
  verdict: TriageVerdict | null;
}
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const URGENCIES = [
  "EMERGENCY",
  "URGENT_CONSULT",
  "CONSULT_24H",
  "ROUTINE",
  "SELF_CARE",
];

/** OpenAI strict structured output — the model literally cannot reply off-schema. */
const TRIAGE_SCHEMA = {
  name: "triage_turn",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      action: { type: "string", enum: ["ask", "verdict"] },
      question: { type: ["string", "null"] },
      verdict: {
        type: ["object", "null"],
        additionalProperties: false,
        properties: {
          urgency: { type: "string", enum: URGENCIES },
          specialty: { type: "string" },
          reasons: { type: "array", items: { type: "string" } },
          selfCare: { type: "array", items: { type: "string" } },
          summary: { type: "string" },
        },
        required: ["urgency", "specialty", "reasons", "selfCare", "summary"],
      },
    },
    required: ["action", "question", "verdict"],
  },
} as const;

export interface QaTurn {
  answer: string;
  suggestConsult: boolean;
  specialty: string | null;
}

/** Q&A mode (Phase 2): free-form answer, still schema-locked for guardrails. */
const QA_SCHEMA = {
  name: "qa_turn",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      answer: { type: "string" },
      suggestConsult: { type: "boolean" },
      specialty: { type: ["string", "null"] },
    },
    required: ["answer", "suggestConsult", "specialty"],
  },
} as const;

/**
 * Thin LLM gateway (OpenAI today; the interface is provider-agnostic so
 * Claude can be added later). No-op-safe: without OPENAI_API_KEY the
 * symptom checker reports itself unavailable instead of erroring.
 */
@Injectable()
export class LlmProvider {
  private readonly logger = new Logger("TriageLLM");
  readonly enabled = !!process.env.OPENAI_API_KEY;
  readonly model = process.env.OPENAI_TRIAGE_MODEL || "gpt-4o-mini";
  readonly transcribeModel = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";
  readonly ttsModel = process.env.OPENAI_TTS_MODEL || "tts-1";
  readonly ttsVoice = process.env.OPENAI_TTS_VOICE || "nova"; // warm, female-presenting — fits Leenah

  /** Text-to-speech for Leenah's replies. Returns mp3 bytes. */
  async speak(text: string): Promise<Buffer> {
    if (!this.enabled) throw new Error("LLM not configured");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: this.ttsModel,
          voice: this.ttsVoice,
          input: text,
          response_format: "mp3",
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`);
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      this.logger.warn(`tts failed: ${(e as Error).message}`);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Whisper transcription for Leenah voice notes. Returns plain text. */
  async transcribe(
    audio: Buffer,
    mimeType: string,
    language?: string,
  ): Promise<string> {
    if (!this.enabled) throw new Error("LLM not configured");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const ext = mimeType.includes("wav")
        ? "wav"
        : mimeType.includes("mp3") || mimeType.includes("mpeg")
          ? "mp3"
          : mimeType.includes("webm")
            ? "webm"
            : mimeType.includes("mp4")
              ? "mp4" // Zego cloud recordings (Whisper accepts video containers)
              : "m4a";
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array(audio)], { type: mimeType }),
        `voice.${ext}`,
      );
      form.append("model", this.transcribeModel);
      form.append("temperature", "0");
      if (language) form.append("language", language);

      const res = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: form,
        },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`);
      }
      const json = (await res.json()) as { text?: string };
      return (json.text ?? "").trim();
    } catch (e) {
      this.logger.warn(`transcription failed: ${(e as Error).message}`);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  async triageTurn(
    system: string,
    history: ChatMessage[],
  ): Promise<TriageTurn> {
    return this.complete<TriageTurn>(system, history, TRIAGE_SCHEMA);
  }

  async qaTurn(system: string, history: ChatMessage[]): Promise<QaTurn> {
    return this.complete<QaTurn>(system, history, QA_SCHEMA);
  }

  /** Generic strict-schema completion for non-triage consumers (e.g. the scribe). */
  async structured<T>(
    system: string,
    history: ChatMessage[],
    schema: unknown,
    opts: { maxTokens?: number } = {},
  ): Promise<T> {
    return this.complete<T>(system, history, schema, opts);
  }

  private async complete<T>(
    system: string,
    history: ChatMessage[],
    schema: unknown,
    opts: { maxTokens?: number } = {},
  ): Promise<T> {
    if (!this.enabled) throw new Error("LLM not configured");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          max_tokens: opts.maxTokens ?? 700,
          messages: [{ role: "system", content: system }, ...history],
          response_format: { type: "json_schema", json_schema: schema },
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`);
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty completion");
      return JSON.parse(content) as T;
    } catch (e) {
      this.logger.warn(`llm turn failed: ${(e as Error).message}`);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
}
