import { NextResponse } from "next/server";
import { checkOllamaHealth } from "@/lib/ai/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await checkOllamaHealth();
  return NextResponse.json(status);
}
