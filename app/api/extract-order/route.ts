import { NextRequest, NextResponse } from "next/server";
import { extractRequestSchema } from "@/lib/schemas/order";
import { extractOrderWithOllama } from "@/lib/ai/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    const validation = extractRequestSchema.safeParse(body);
    if (!validation.success) {
      const errorMessage = validation.error.errors
        .map((e) => e.message)
        .join(". ");
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { message, referenceDate } = validation.data;

    // Execute local extraction with Gemma 3 4B via Ollama
    const result = await extractOrderWithOllama(message, referenceDate);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Order extraction failed.",
          durationMs: result.durationMs,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data,
        durationMs: result.durationMs,
        modelUsed: result.modelUsed,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    // Never expose stack traces or raw errors in API responses
    const message =
      err instanceof Error ? "An unexpected server error occurred." : "Extraction error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
