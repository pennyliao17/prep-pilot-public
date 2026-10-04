// Rotates the Neon password (via ALTER ROLE, using the current credentials —
// no Neon console access needed) and APP_SECRET, writing both into .dev.vars
// (and DATABASE_URL into .env for the migrate script). This only updates local
// files. After running, you still need to:
//   1. `wrangler secret put DATABASE_URL` and `wrangler secret put APP_SECRET`
//      (pipe from .dev.vars, don't retype the values)
//   2. Copy the new APP_SECRET into frontend/.env.local and .env.production
//   3. Rebuild + redeploy the frontend so it ships the new key
import { readFileSync, writeFileSync } from "node:fs";
import crypto from "node:crypto";
import pg from "pg";

const devVarsPath = process.argv[2];
const envPath = process.argv[3];

function parseEnvFile(path) {
	const text = readFileSync(path, "utf8");
	const vars = {};
	for (const line of text.split("\n")) {
		const idx = line.indexOf("=");
		if (idx === -1) continue;
		vars[line.slice(0, idx)] = line.slice(idx + 1);
	}
	return vars;
}

function writeEnvFile(path, vars) {
	const text = Object.entries(vars)
		.map(([k, v]) => `${k}=${v}`)
		.join("\n") + "\n";
	writeFileSync(path, text);
}

const vars = parseEnvFile(devVarsPath);
const oldUrl = new URL(vars.DATABASE_URL);
const user = decodeURIComponent(oldUrl.username);

const newPassword = crypto.randomBytes(24).toString("base64url");
const newAppSecret = crypto.randomBytes(24).toString("base64url");

const client = new pg.Client({ connectionString: vars.DATABASE_URL });
await client.connect();
await client.query(`ALTER ROLE "${user}" WITH PASSWORD '${newPassword}'`);
await client.end();

const newUrl = new URL(oldUrl.toString());
newUrl.password = encodeURIComponent(newPassword);

const newVars = { ...vars, DATABASE_URL: newUrl.toString(), APP_SECRET: newAppSecret };
writeEnvFile(devVarsPath, newVars);

if (envPath) {
	const envVars = parseEnvFile(envPath);
	envVars.DATABASE_URL = newUrl.toString();
	writeEnvFile(envPath, envVars);
}

// Verify the new password actually works before we consider this done.
const verifyClient = new pg.Client({ connectionString: newUrl.toString() });
await verifyClient.connect();
await verifyClient.query("select 1");
await verifyClient.end();

console.log("Rotated Neon password and APP_SECRET successfully. New credentials verified working.");
