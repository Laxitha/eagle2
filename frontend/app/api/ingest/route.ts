import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { randomUUID } from "crypto";
import { nameKey, parseUpload, samePerson } from "@/lib/ingestParsers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE = 1000; // PostgREST returns at most this many rows per request
const BATCH = 500;

async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(`reading ${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return out;
  }
}

async function writeAll(table: string, rows: Record<string, unknown>[], upsert = false) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = upsert
      ? await supabaseAdmin.from(table).upsert(chunk, { onConflict: "id" })
      : await supabaseAdmin.from(table).insert(chunk);
    if (error) throw new Error(`writing ${table}: ${error.message}`);
  }
}

function newId(label: string, name: string, taken: Set<string>): string {
  const slug = nameKey(name).replace(/^ph:/, "").replace(/\s+/g, "-").slice(0, 60) || "x";
  let id = `${label.slice(0, 3).toUpperCase()}-${slug}`;
  for (let n = 2; taken.has(id); n++) id = `${label.slice(0, 3).toUpperCase()}-${slug}-${n}`;
  taken.add(id);
  return id;
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database is not configured on the server." }, { status: 500 });
  }
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  try {
    const parsed = await parseUpload(file.name, await file.arrayBuffer());

    // Nothing recognised: say so, and don't log an upload that added nothing.
    if (parsed.entities.length === 0) {
      return NextResponse.json(
        { error: parsed.note ?? "No records were recognised in this file.", file: file.name },
        { status: 422 },
      );
    }

    // Join to what is already in the graph by name, so "Ravi Kumar" in a new
    // file is the Ravi Kumar already there, not a second node beside him.
    // A person also matches a spelling variant already in the graph ("Divya
    // Sumathi Mudaliar K" -> "Divya Sumathi Mudaliar"); see samePerson.
    const existing = await fetchAll<{ id: string; name: string; label: string }>("entities", "id, name, label");
    const idByKey = new Map(existing.map((e) => [nameKey(e.name), e.id]));
    const people = existing.filter((e) => e.label === "Person");
    const taken = new Set(existing.map((e) => e.id));

    const fileToDb = new Map<string, string>();
    const fresh: Record<string, unknown>[] = [];
    for (const e of parsed.entities) {
      let id = idByKey.get(e.key);
      if (!id && e.label === "Person") {
        const names = [e.name, ...((e.meta.aliases as string[]) ?? [])];
        id = people.find((p) => names.some((n) => samePerson(p.name, n)))?.id;
      }
      if (!id) {
        id = newId(e.label, e.name, taken);
        idByKey.set(e.key, id);
        fresh.push({ id, label: e.label, name: e.name, metadata: { ...e.meta, source_file: file.name } });
        if (e.label === "Person") people.push({ id, name: e.name, label: e.label });
      }
      fileToDb.set(e.key, id);
    }

    // Skip links the graph already has, so uploading a file twice adds nothing.
    const linkKey = (s: string, t: string, type: string) => `${s}|${t}|${type}`;
    const seen = new Set(
      (await fetchAll<{ source_id: string; target_id: string; type: string }>(
        "relationships",
        "source_id, target_id, type",
      )).map((r) => linkKey(r.source_id, r.target_id, r.type)),
    );
    const links: Record<string, unknown>[] = [];
    for (const l of parsed.links) {
      const s = fileToDb.get(l.source);
      const t = fileToDb.get(l.target);
      if (!s || !t || seen.has(linkKey(s, t, l.type))) continue;
      seen.add(linkKey(s, t, l.type));
      links.push({
        id: randomUUID(),
        source_id: s,
        target_id: t,
        type: l.type,
        confidence: l.confidence,
        metadata: { source_file: file.name },
      });
    }

    await writeAll("entities", fresh, true);
    await writeAll("relationships", links);

    const matched = parsed.entities.length - fresh.length;
    const detail =
      `Parsed ${parsed.records} records from ${file.name}: ${fresh.length} new entities` +
      (matched ? `, ${matched} matched to existing ones` : "") +
      `, ${links.length} new links.`;
    const { error: logError } = await supabaseAdmin.from("ingestions").insert({
      id: randomUUID(),
      filename: file.name,
      type: parsed.kind,
      status: "ingested",
      records: parsed.records,
      entities: fresh.length,
      relationships: links.length,
      detail,
      date: new Date().toISOString(),
    });
    if (logError) throw new Error(`writing ingestions: ${logError.message}`);

    const { data: stats } = await supabaseAdmin.from("case_stats").select("*").single();

    return NextResponse.json({
      file: file.name,
      parsed_records: parsed.records,
      parsed_relations: parsed.links.length,
      new_entities: fresh.length,
      matched_entities: matched,
      new_relations: links.length,
      detail,
      totals: stats,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Could not read this file.", file: file.name }, { status: 500 });
  }
}
