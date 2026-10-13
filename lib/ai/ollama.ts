import { SYSTEM_PROMPT, buildExtractionPrompt } from "./prompts";
import { parseGemmaOutput, type ParseResult } from "./parse-output";

// Server-only environment variable resolution with safe local defaults
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";
const OLLAMA_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || "45000", 10);

export interface OllamaExtractionResult {
  success: boolean;
  data?: ParseResult["data"];
  error?: string;
  durationMs: number;
  modelUsed: string;
}

export interface OllamaStatus {
  available: boolean;
  modelInstalled: boolean;
  modelName: string;
  baseUrl: string;
  error?: string;
}

/**
 * Checks connection to local Ollama instance and verifies whether
 * the designated model (gemma3:4b) is available.
 */
export async function checkOllamaHealth(): Promise<OllamaStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        available: false,
        modelInstalled: false,
        modelName: OLLAMA_MODEL,
        baseUrl: OLLAMA_BASE_URL,
        error: `Ollama service returned HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    const models: Array<{ name: string }> = data.models || [];
    const hasModel = models.some(
      (m) =>
        m.name === OLLAMA_MODEL ||
        m.name.startsWith(`${OLLAMA_MODEL}:`) ||
        m.name.includes("gemma3:4b")
    );

    return {
      available: true,
      modelInstalled: hasModel,
      modelName: OLLAMA_MODEL,
      baseUrl: OLLAMA_BASE_URL,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error && err.name === "AbortError"
        ? `Connection to Ollama timed out at ${OLLAMA_BASE_URL}`
        : `Cannot connect to Ollama at ${OLLAMA_BASE_URL}. Ensure Ollama is running.`;
    return {
      available: false,
      modelInstalled: false,
      modelName: OLLAMA_MODEL,
      baseUrl: OLLAMA_BASE_URL,
      error: errorMsg,
    };
  }
}

/**
 * Executes a single, strictly typed extraction call against local Ollama.
 * Stream is disabled to preserve memory on an 8 GB RAM laptop.
 */
export async function extractOrderWithOllama(
  customerMessage: string,
  referenceDate?: string
): Promise<OllamaExtractionResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    const userPrompt = buildExtractionPrompt(customerMessage, referenceDate);

    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        format: "json",
        options: {
          temperature: 0.1, // low temperature for strictly factual structured output
          top_p: 0.9,
          num_ctx: 4096,
        },
      }),
    });

    clearTimeout(timeout);
    const durationMs = Date.now() - startTime;

    if (!res.ok) {
      if (res.status === 404) {
        return {
          success: false,
          error: `Model '${OLLAMA_MODEL}' not found in Ollama. Run: 'ollama pull ${OLLAMA_MODEL}' to download it.`,
          durationMs,
          modelUsed: OLLAMA_MODEL,
        };
      }
      return {
        success: false,
        error: `Ollama extraction failed with HTTP status ${res.status}`,
        durationMs,
        modelUsed: OLLAMA_MODEL,
      };
    }

    const payload = await res.json();
    const assistantContent = payload.message?.content;

    if (!assistantContent) {
      return {
        success: false,
        error: "Ollama returned an empty response.",
        durationMs,
        modelUsed: OLLAMA_MODEL,
      };
    }

    // Parse and validate with Zod
    const parseResult = parseGemmaOutput(assistantContent);

    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error || "Model output failed schema validation.",
        durationMs,
        modelUsed: OLLAMA_MODEL,
      };
    }

    return {
      success: true,
      data: parseResult.data,
      durationMs,
      modelUsed: OLLAMA_MODEL,
    };
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;

    if (err instanceof Error && err.name === "AbortError") {
      return {
        success: false,
        error: `Extraction timed out after ${OLLAMA_TIMEOUT_MS / 1000}s. Your laptop may be busy. Please check that Ollama is running and try again.`,
        durationMs,
        modelUsed: OLLAMA_MODEL,
      };
    }

    return {
      success: false,
      error: `Could not reach Ollama at ${OLLAMA_BASE_URL}. Ensure Ollama is running locally ('ollama serve') and Gemma 3 4B is installed.`,
      durationMs,
      modelUsed: OLLAMA_MODEL,
    };
  }
}
