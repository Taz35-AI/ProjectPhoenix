// Run a SQL file (or inline SQL) against the linked Supabase project via the
// Management API, authenticated with SUPABASE_ACCESS_TOKEN. No DB password
// required. Reads env from .env.local.
//
// Usage:
//   node scripts/db-execute.mjs supabase/migrations/0001_init.sql
//   node scripts/db-execute.mjs --sql "select now();"
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* ignore — rely on real env */
  }
}
loadEnv();

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error("Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN in .env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
let query;
const sqlFlag = args.indexOf("--sql");
if (sqlFlag !== -1) {
  query = args[sqlFlag + 1];
} else if (args[0]) {
  query = readFileSync(resolve(process.cwd(), args[0]), "utf8");
} else {
  console.error("Provide a .sql file path or --sql \"...\"");
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ query }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  console.error(text.slice(0, 2000));
  process.exit(1);
}
console.log("OK");
// Only print rows for SELECT-style output; DDL returns [].
try {
  const json = JSON.parse(text);
  if (Array.isArray(json) && json.length) console.log(JSON.stringify(json, null, 2).slice(0, 4000));
} catch {
  /* non-JSON body */
}
