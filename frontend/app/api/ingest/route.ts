import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { randomUUID } from "crypto";

function parseCsv(text: string): string[][] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((c) => c.trim()));
}

function parseJson(text: string): Record<string, unknown>[] {
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function stableId(name: string): string {
  return "e-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const text = await file.text();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  let parsedRecords = 0;
  let parsedRelations = 0;
  const entityMap = new Map<string, { id: string; label: string; name: string }>();
  const relationships: { source_id: string; target_id: string; type: string; confidence: number }[] = [];

  function addEntity(name: string, label: string) {
    const id = stableId(name);
    if (!entityMap.has(id)) {
      entityMap.set(id, { id, label, name });
    }
  }

  try {
    if (["csv", "tsv", "txt"].includes(ext)) {
      const rows = parseCsv(text);
      const header = rows[0]?.map((h) => h.toLowerCase()) ?? [];
      const nameIdx = header.findIndex((h) => ["name", "entity", "person", "subject"].includes(h));
      const typeIdx = header.findIndex((h) => ["type", "label", "category"].includes(h));
      const sourceIdx = header.findIndex((h) => ["source", "from", "caller"].includes(h));
      const targetIdx = header.findIndex((h) => ["target", "to", "receiver"].includes(h));
      const relTypeIdx = header.findIndex((h) =>
        h === "relation" || h === "relationship" || h === "link" || h === "rel_type"
      );

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (nameIdx >= 0 && row[nameIdx]) {
          addEntity(row[nameIdx], row[typeIdx] || "Person");
          parsedRecords++;
        }
        if (sourceIdx >= 0 && targetIdx >= 0 && row[sourceIdx] && row[targetIdx]) {
          const srcName = row[sourceIdx];
          const tgtName = row[targetIdx];
          const srcType = header[sourceIdx] === "caller" ? "Phone" : "Person";
          const tgtType = header[targetIdx] === "receiver" ? "Phone" : "Person";
          addEntity(srcName, srcType);
          addEntity(tgtName, tgtType);
          relationships.push({
            source_id: stableId(srcName),
            target_id: stableId(tgtName),
            type: (relTypeIdx >= 0 && row[relTypeIdx]) ? row[relTypeIdx] : "LINKED_TO",
            confidence: 0.8,
          });
          parsedRelations++;
        }
      }
    } else if (ext === "json") {
      const records = parseJson(text);
      for (const rec of records) {
        const name = (rec.name as string) || (rec.entity as string) || "";
        const label = (rec.type as string) || (rec.label as string) || "Person";
        if (name) {
          addEntity(name, label);
          parsedRecords++;
        }
        if (rec.source && rec.target) {
          const srcName = rec.source as string;
          const tgtName = rec.target as string;
          addEntity(srcName, (rec.source_type as string) || "Person");
          addEntity(tgtName, (rec.target_type as string) || "Person");
          relationships.push({
            source_id: stableId(srcName),
            target_id: stableId(tgtName),
            type: (rec.relationship as string) || (rec.rel_type as string) || "LINKED_TO",
            confidence: Number(rec.confidence) || 0.8,
          });
          parsedRelations++;
        }
      }
    } else {
      parsedRecords = 1;
    }

    const entities = Array.from(entityMap.values());

    if (entities.length > 0) {
      await supabaseAdmin.from("entities").upsert(entities, { onConflict: "id" });
    }
    if (relationships.length > 0) {
      const rels = relationships.map((r) => ({ id: randomUUID(), ...r }));
      await supabaseAdmin.from("relationships").insert(rels);
    }

    await supabaseAdmin.from("ingestions").insert({
      id: randomUUID(),
      filename: file.name,
      type: ext === "json" ? "osint" : "cdr",
      status: "ingested",
      records: parsedRecords,
      entities: entities.length,
      relationships: relationships.length,
      detail: `Parsed ${parsedRecords} records, ${parsedRelations} relations from ${file.name}`,
      date: new Date().toISOString(),
    });

    const { data: stats } = await supabaseAdmin.from("case_stats").select("*").single();

    return NextResponse.json({
      file: file.name,
      parsed_records: parsedRecords,
      parsed_relations: parsedRelations,
      totals: stats ?? { entities: entities.length, relationships: relationships.length, cases: 0, files: 1, records: parsedRecords },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Parse error" }, { status: 500 });
  }
}
