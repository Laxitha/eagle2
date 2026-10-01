import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET() {
  const [nodesRes, edgesRes] = await Promise.all([
    supabaseAdmin.from("entities").select("id, label, name"),
    supabaseAdmin.from("relationships").select("source_id, target_id, type, confidence"),
  ]);

  if (nodesRes.error) return NextResponse.json({ error: nodesRes.error.message }, { status: 500 });
  if (edgesRes.error) return NextResponse.json({ error: edgesRes.error.message }, { status: 500 });

  const nodes = (nodesRes.data ?? []).map((e) => ({
    id: e.id,
    label: e.label,
    name: e.name,
  }));

  const edges = (edgesRes.data ?? []).map((r) => ({
    source: r.source_id,
    target: r.target_id,
    type: r.type,
    confidence: Number(r.confidence),
  }));

  return NextResponse.json({ nodes, edges });
}
