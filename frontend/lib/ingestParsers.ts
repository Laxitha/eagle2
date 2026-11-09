// Turns an uploaded file into entities + links for the case graph.
//
// Every parser returns the same shape, so the ingest route only has to merge
// one thing into the database. A format we cannot read returns no entities
// and a `note` saying why — the route reports that instead of logging an
// upload that added nothing.

export type EntityType = "Person" | "Phone" | "Case" | "Vehicle" | "Account" | "Location";

export interface ParsedEntity {
  key: string; // file-local id, used only to join links to entities
  name: string;
  label: EntityType;
  meta: Record<string, unknown>;
}

export interface ParsedLink {
  source: string; // ParsedEntity.key
  target: string;
  type: string;
  confidence: number;
}

export interface Parsed {
  records: number;
  entities: ParsedEntity[];
  links: ParsedLink[];
  kind: "cdr" | "financial" | "fir" | "vehicle" | "osint";
  note?: string;
}

const PHONE_RE = /^\+?[\d\s-]{8,}\d$/;
const PLATE_RE = /^[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{3,4}$/i;
const ACCOUNT_RE = /^\d{9,18}$|^\d{2,6}\.{2,3}\d{2,6}$/;

// Source-system types folded onto the six the graph knows. The original type
// is kept in metadata, so "Accused" vs "Complainant" is not lost.
const TYPE_MAP: [RegExp, EntityType][] = [
  [/phone|mobile|msisdn|imei|sim/i, "Phone"],
  [/vehicle|car|bike|plate|anpr/i, "Vehicle"],
  [/account|bank|upi|wallet/i, "Account"],
  [/fir|case|offen[cs]e|crime|report|log|complaint$/i, "Case"],
  [/locat|locality|station|district|address|place|city|area|tower|unit|house/i, "Location"],
  [/person|accused|complainant|suspect|victim|subject|officer|witness|criminal|informant|associate|individual/i, "Person"],
];

export function toEntityType(type: unknown, name: string): EntityType {
  const t = String(type ?? "").trim();
  if (t) {
    for (const [re, label] of TYPE_MAP) if (re.test(t)) return label;
  }
  const n = name.trim();
  if (PHONE_RE.test(n)) return "Phone";
  if (PLATE_RE.test(n)) return "Vehicle";
  if (ACCOUNT_RE.test(n)) return "Account";
  if (/^(fir|case|crime no)\b/i.test(n)) return "Case";
  return "Person";
}

/** One name, one key: case, spacing, underscores and punctuation ignored;
 *  phone numbers compared on their last ten digits. */
export function nameKey(name: string): string {
  const digits = name.replace(/\D/g, "");
  if (PHONE_RE.test(name.trim()) && digits.length >= 10) return "ph:" + digits.slice(-10);
  return name
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .replace(/[^\p{L}\p{M}\p{N} ]/gu, "")
    .trim();
}

const HONORIFIC = /^(mr|mrs|ms|miss|dr|shri|sri|smt|thiru|thirumathi|selvi|kumari|late)$/;

/** A person's name split into the words that identify them and the initials
 *  around them: "Shri. K. Divya Sumathi Mudaliar" -> core "divya mudaliar
 *  sumathi" (sorted, so word order does not matter), initials ["k"]. */
export function personParts(name: string): { core: string; initials: string[] } {
  const words = name
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s.]/gu, " ")
    .split(/[\s.]+/)
    .filter((w) => w && !HONORIFIC.test(w));
  const full = words.filter((w) => w.length > 1);
  const initials = words.filter((w) => w.length === 1).sort();
  return { core: full.sort().join(" "), initials };
}

/** Same person written two ways? Only when at least two full name words match
 *  exactly and the initials do not disagree. "Divya Sumathi Mudaliar K" and
 *  "Divya Sumathi Mudaliar" are one person; "Murugan N" and "Murugan J" are
 *  two, and a single shared word ("Sundaram") is never enough on its own. */
export function samePerson(a: string, b: string): boolean {
  const pa = personParts(a);
  const pb = personParts(b);
  if (!pa.core || pa.core !== pb.core || pa.core.split(" ").length < 2) return false;
  if (!pa.initials.length || !pb.initials.length) return true;
  return pa.initials.join() === pb.initials.join();
}

function clean(name: unknown): string {
  return String(name ?? "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

class Builder {
  entities = new Map<string, ParsedEntity>();
  links: ParsedLink[] = [];
  records = 0;

  add(rawName: unknown, type?: unknown, meta: Record<string, unknown> = {}): string | null {
    const name = clean(rawName);
    if (!name) return null;
    let key = nameKey(name);
    if (!key) return null;
    const label = toEntityType(type, name);
    // A spelling variant of a person already in this file is that person.
    if (label === "Person" && !this.entities.has(key)) {
      const same = Array.from(this.entities.values()).find((e) => e.label === "Person" && samePerson(e.name, name));
      if (same) {
        key = same.key;
        const aliases = new Set([...((same.meta.aliases as string[]) ?? []), name]);
        same.meta.aliases = Array.from(aliases);
      }
    }
    const existing = this.entities.get(key);
    if (existing) {
      Object.assign(existing.meta, { ...meta, aliases: existing.meta.aliases });
    } else {
      this.entities.set(key, { key, name, label, meta: { ...meta } });
    }
    return key;
  }

  link(a: string | null, b: string | null, type?: unknown, confidence?: unknown) {
    if (!a || !b || a === b) return;
    const c = Number(confidence);
    this.links.push({
      source: a,
      target: b,
      type: String(type || "LINKED_TO").toUpperCase().replace(/[\s-]+/g, "_"),
      confidence: c > 0 && c <= 1 ? c : 0.8,
    });
  }

  done(kind: Parsed["kind"], note?: string): Parsed {
    const entities = Array.from(this.entities.values());
    return {
      records: this.records,
      entities,
      links: this.links,
      kind,
      note: entities.length ? undefined : note,
    };
  }
}

// ---------------------------------------------------------------- tables

function splitRow(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const COLS = {
  name: ["name", "entity", "person", "subject", "fullname", "full_name", "accused", "suspect", "owner", "holder"],
  type: ["type", "label", "category", "entity_type", "kind"],
  source: ["source", "from", "caller", "sender", "calling_number", "a_party", "from_account"],
  target: ["target", "to", "receiver", "recipient", "called_number", "b_party", "to_account"],
  rel: ["relation", "relationship", "link", "rel_type", "edge_type"],
  phone: ["phone", "mobile", "msisdn", "contact", "phone_number"],
  vehicle: ["vehicle", "plate", "registration", "reg_no", "vehicle_no"],
  account: ["account", "account_no", "account_number", "acc_no"],
  case: ["case", "case_id", "fir", "fir_number", "fir_no", "case_no"],
  location: ["location", "address", "place", "tower_location", "station"],
  confidence: ["confidence", "score", "weight"],
};

function col(header: string[], names: string[]): number {
  return header.findIndex((h) => names.includes(h));
}

function parseTable(rows: string[][], b: Builder): void {
  const header = (rows[0] ?? []).map((h) => h.toLowerCase().trim().replace(/[\s-]+/g, "_"));
  const ix = Object.fromEntries(Object.entries(COLS).map(([k, v]) => [k, col(header, v)])) as Record<
    keyof typeof COLS,
    number
  >;
  const srcIsPhone = ["caller", "calling_number", "a_party"].includes(header[ix.source]);
  const srcIsAcc = ["sender", "from_account"].includes(header[ix.source]);

  for (const row of rows.slice(1)) {
    const get = (i: number) => (i >= 0 ? row[i] ?? "" : "");
    let touched = false;

    const person = b.add(get(ix.name), get(ix.type) || "Person", { file_row: true });
    if (person) touched = true;

    const attach = (value: string, type: EntityType, rel: string) => {
      const k = b.add(value, type);
      if (k && person) b.link(person, k, rel);
      if (k) touched = true;
      return k;
    };
    attach(get(ix.phone), "Phone", "OWNS_PHONE");
    attach(get(ix.vehicle), "Vehicle", "OWNS_VEHICLE");
    attach(get(ix.account), "Account", "HOLDS_ACCOUNT");
    const caseKey = attach(get(ix.case), "Case", "NAMED_IN");
    if (ix.source < 0) attach(get(ix.location), "Location", "LOCATED_AT");

    if (ix.source >= 0 && ix.target >= 0 && get(ix.source) && get(ix.target)) {
      const kind = srcIsPhone ? "Phone" : srcIsAcc ? "Account" : undefined;
      const s = b.add(get(ix.source), kind);
      const t = b.add(get(ix.target), kind);
      b.link(s, t, get(ix.rel) || (srcIsPhone ? "CALLED" : srcIsAcc ? "TRANSFERRED" : ""), get(ix.confidence));
      const loc = get(ix.location);
      if (loc && s) b.link(s, b.add(loc, "Location"), "SEEN_AT");
      if (caseKey && s) b.link(s, caseKey, "NAMED_IN");
      touched = true;
    }
    if (touched) b.records++;
  }
}

// ---------------------------------------------------------------- JSON

function parseJson(text: string, b: Builder): void {
  const data = JSON.parse(text);
  const obj = Array.isArray(data) ? null : data;

  // node-link graph: {nodes, edges} / {nodes, links} (networkx, cytoscape, d3)
  const nodes = obj?.nodes ?? obj?.elements?.nodes;
  const edges = obj?.edges ?? obj?.links ?? obj?.elements?.edges;
  if (Array.isArray(nodes)) {
    const byId = new Map<string, string | null>();
    for (const raw of nodes) {
      const n = raw?.data ?? raw;
      const name = n.name ?? n.label ?? n.title ?? n.id;
      const { id, name: _n, label: _l, type, ...rest } = n;
      byId.set(String(n.id ?? name), b.add(name, type ?? n.category ?? (n.name ? n.label : undefined), rest));
      b.records++;
    }
    for (const raw of edges ?? []) {
      const e = raw?.data ?? raw;
      b.link(
        byId.get(String(e.source)) ?? b.add(e.source),
        byId.get(String(e.target)) ?? b.add(e.target),
        e.relation ?? e.relationship ?? e.type ?? e.label,
        e.confidence ?? e.weight,
      );
    }
    return;
  }

  // a list of records; nested under a common key if not top-level
  const list: unknown[] = Array.isArray(data)
    ? data
    : (Object.values(obj ?? {}).find(Array.isArray) as unknown[]) ?? [obj];
  const rows = list.filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
  if (!rows.length) return;
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const table = [keys, ...rows.map((r) => keys.map((k) => (r[k] == null ? "" : String(r[k]))))];
  parseTable(table, b);
  // explicit endpoint types, when the records carry them
  for (const r of rows) {
    if (r.source && r.source_type) b.add(r.source, r.source_type);
    if (r.target && r.target_type) b.add(r.target, r.target_type);
  }
  for (const e of b.entities.values()) {
    const r = rows.find((x) => clean(x.source) === e.name || clean(x.target) === e.name);
    if (r) {
      const t = clean(r.source) === e.name ? r.source_type : r.target_type;
      if (t) e.label = toEntityType(t, e.name);
    }
  }
}

// ---------------------------------------------------------------- GML

type GmlValue = string | number | GmlObj;
interface GmlObj {
  [k: string]: GmlValue | GmlValue[];
}

function parseGmlTree(text: string): GmlObj {
  const tokens = text.match(/"(?:[^"\\]|\\.)*"|\[|\]|[^\s\[\]"]+/g) ?? [];
  let i = 0;
  function block(): GmlObj {
    const out: GmlObj = {};
    while (i < tokens.length && tokens[i] !== "]") {
      const key = tokens[i++];
      const tok = tokens[i++];
      let val: GmlValue;
      if (tok === "[") {
        val = block();
        i++; // closing ]
      } else if (tok?.startsWith('"')) val = tok.slice(1, -1);
      else val = isNaN(Number(tok)) ? tok : Number(tok);
      const prev = out[key];
      if (prev === undefined) out[key] = val;
      else out[key] = Array.isArray(prev) ? [...prev, val] : [prev, val];
    }
    return out;
  }
  return block();
}

const asList = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function parseGml(text: string, b: Builder): void {
  const graph = parseGmlTree(text).graph as GmlObj | undefined;
  if (!graph) return;
  const byId = new Map<string, string | null>();
  for (const n of asList(graph.node as GmlObj | GmlObj[])) {
    const { id, label, type, ...rest } = n;
    const name = String(label ?? id ?? "");
    // An FIR node's label is "FIR 1000/2026"; long free-text "Offence" nodes
    // are kept as metadata on the FIR rather than as graph entities.
    if (String(type ?? "").toLowerCase() === "offence" && name.length > 60) {
      byId.set(String(id), null);
      continue;
    }
    byId.set(String(id), b.add(name, type, rest as Record<string, unknown>));
    b.records++;
    // Contact details on a person node become their own linked entities.
    const k = byId.get(String(id)) ?? null;
    if (typeof rest.phone === "string") b.link(k, b.add(rest.phone, "Phone"), "OWNS_PHONE");
    if (typeof rest.vehicle_noted === "string" && rest.vehicle_noted !== "None")
      b.link(k, b.add(rest.vehicle_noted, "Vehicle"), "SEEN_WITH");
  }
  for (const e of asList(graph.edge as GmlObj | GmlObj[])) {
    b.link(
      byId.get(String(e.source)) ?? null,
      byId.get(String(e.target)) ?? null,
      e.relation ?? e.label ?? e.type,
      e.confidence ?? e.weight,
    );
  }
}

// ---------------------------------------------------------------- GraphML

function parseGraphml(text: string, b: Builder): void {
  const keyNames = new Map<string, string>();
  for (const m of text.matchAll(/<key\b[^>]*\bid="([^"]+)"[^>]*\battr\.name="([^"]+)"/g)) keyNames.set(m[1], m[2]);
  const attrs = (body: string) => {
    const out: Record<string, string> = {};
    for (const m of body.matchAll(/<data\b[^>]*\bkey="([^"]+)"[^>]*>([\s\S]*?)<\/data>/g))
      out[keyNames.get(m[1]) ?? m[1]] = m[2].trim();
    return out;
  };
  const byId = new Map<string, string | null>();
  for (const m of text.matchAll(/<node\b[^>]*\bid="([^"]+)"[^>]*?(?:\/>|>([\s\S]*?)<\/node>)/g)) {
    const a = attrs(m[2] ?? "");
    const { label, name, type, ...rest } = a;
    byId.set(m[1], b.add(name ?? label ?? m[1], type, rest));
    b.records++;
  }
  for (const m of text.matchAll(/<edge\b([^>]*?)(?:\/>|>([\s\S]*?)<\/edge>)/g)) {
    const s = /\bsource="([^"]+)"/.exec(m[1])?.[1] ?? "";
    const t = /\btarget="([^"]+)"/.exec(m[1])?.[1] ?? "";
    const a = attrs(m[2] ?? "");
    b.link(byId.get(s) ?? null, byId.get(t) ?? null, a.relation ?? a.label ?? a.type, a.confidence ?? a.weight);
  }
}

// ---------------------------------------------------------------- free text (FIR PDFs, .txt reports)

const FIR_RE = /\b(?:FIR|Crime)\s*(?:No\.?|Number)?\s*[:.]?\s*(\d{1,6}\s*\/\s*\d{2,4})/i;
const PHONE_IN_TEXT = /(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g;
const PERSON = "([A-Z][a-z]+(?:\\s+[A-Z][a-z]*\\.?){0,3}(?:\\s+[A-Z][a-z]+))";
const ROLE_RE = new RegExp(
  "\\b(complainant|accused|victim|witness|suspect)\\b,?\\s+(?:is\\s+|named\\s+|being\\s+)?" +
    "(?:Mr\\.?|Mrs\\.?|Ms\\.?|Shri\\.?|Smt\\.?|Thiru\\.?|Selvi\\.?)?\\s*" + PERSON,
  "g",
);
// Words that start a capitalised phrase without it being a person.
const NOT_A_NAME = /^(One|Unknown|The|An?|Police|Inspector|Sub|Station|Court|Not|Nil)\b/;

/** The value on the line after a form label, e.g. "(a) Name\nFernando Sundaram". */
function field(body: string, label: RegExp): string {
  const m = new RegExp(label.source + "\\s*([^\\n]+)", "i").exec(body);
  return m ? m[1].trim() : "";
}

function section(body: string, from: RegExp, to: RegExp): string {
  const a = from.exec(body);
  if (!a) return "";
  const rest = body.slice((a.index ?? 0) + a[0].length);
  const b = to.exec(rest);
  return b ? rest.slice(0, b.index) : rest;
}

function parseText(text: string, b: Builder): void {
  // One chunk per report: the FIR form header if the file has it, otherwise
  // the whole text. People are tied to the FIR whose text they appear in.
  const chunks = /FIRST INFORMATION REPORT/.test(text)
    ? text.split(/FIRST INFORMATION REPORT/).slice(1)
    : [text];

  for (const body of chunks) {
    const firNo = FIR_RE.exec(body)?.[1]?.replace(/\s/g, "");
    const caseKey = firNo ? b.add("FIR " + firNo, "Case") : null;
    const tie = (name: string, role: string, meta: Record<string, unknown> = {}) => {
      if (!name || NOT_A_NAME.test(name)) return null;
      const k = b.add(name, "Person", { role, ...meta });
      b.link(k, caseKey, `${role}_IN`);
      if (k) b.records++;
      return k;
    };

    // Integrated Investigation Form fields, when the PDF is one.
    const station = field(body, /\d+\.\s*Police Station\s*\n/);
    if (station && caseKey) b.link(caseKey, b.add(station + " P.S.", "Location"), "REGISTERED_AT");
    const complainantBlock = section(body, /Complainant\s*\/\s*Informant/i, /\n\s*9\.\s/);
    const complainant = tie(field(complainantBlock, /\(a\)\s*Name\s*\n/), "COMPLAINANT");
    const phone = field(complainantBlock, /\bPhone\s*\n/);
    if (complainant && phone) b.link(complainant, b.add(phone, "Phone"), "OWNS_PHONE");
    const accused = section(body, /Details of known.*accused[^\n]*\n/i, /\n\s*10\.\s/);
    for (const m of accused.matchAll(/^\s*\d+\.\s*([^,\n]+)/gm)) tie(m[1].trim(), "ACCUSED");
    const officer = field(body, /Signature of the Officer in charge[^\n]*\n/i);
    if (officer && !/^\d/.test(officer)) tie(officer, "OFFICER");

    // Free text: only names introduced by a role ("the complainant, X").
    for (const m of body.matchAll(ROLE_RE)) tie(m[2], m[1].toUpperCase());
    for (const m of body.matchAll(PHONE_IN_TEXT)) b.link(b.add(m[0], "Phone"), caseKey, "NAMED_IN");
  }
}

async function pdfText(data: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

// ---------------------------------------------------------------- entry

export async function parseUpload(filename: string, data: ArrayBuffer): Promise<Parsed> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const b = new Builder();

  if (ext === "pdf") {
    const text = await pdfText(data);
    if (!text.trim())
      return b.done("fir", "This PDF has no text layer (it looks scanned), so nothing could be read from it.");
    parseText(text, b);
    return b.done("fir", "No names, phone numbers or FIR numbers were found in this PDF.");
  }

  const text = new TextDecoder("utf-8").decode(data).replace(/^﻿/, "");

  if (ext === "gml") {
    parseGml(text, b);
    return b.done("osint", "No nodes were found in this GML file.");
  }
  if (ext === "graphml" || (ext === "xml" && /<graphml/i.test(text.slice(0, 500)))) {
    parseGraphml(text, b);
    return b.done("osint", "No nodes were found in this GraphML file.");
  }
  if (ext === "json") {
    parseJson(text, b);
    return b.done("osint", "No records with a name, or a source and target, were found in this JSON.");
  }
  if (ext === "csv" || ext === "tsv" || ext === "txt") {
    const sep = ext === "tsv" || (text.split("\n")[0].includes("\t") && !text.split("\n")[0].includes(",")) ? "\t" : ",";
    const rows = text.split(/\r?\n/).filter((l) => l.trim()).map((l) => splitRow(l, sep));
    const looksTabular = rows.length > 1 && rows[0].length > 1;
    if (looksTabular) parseTable(rows, b);
    if (!b.entities.size && ext === "txt") parseText(text, b);
    const kind = rows[0]?.some((h) => /caller|receiver|duration/i.test(h)) ? "cdr" : ext === "txt" ? "fir" : "osint";
    return b.done(
      kind,
      "No recognisable columns. Include a name column, or source and target columns (e.g. caller, receiver).",
    );
  }
  return b.done("osint", `.${ext} files are not supported. Use CSV, TSV, TXT, JSON, GML, GraphML or PDF.`);
}
