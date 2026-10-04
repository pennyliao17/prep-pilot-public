import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with: node --env-file=.env scripts/migrate.mjs");
  process.exit(1);
}

const migrationFile = process.argv[2] ?? "0001_init.sql";
const sql = readFileSync(path.join(__dirname, "../migrations", migrationFile), "utf8");

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(sql);
  console.log(`Applied ${migrationFile}`);
} finally {
  await client.end();
}
