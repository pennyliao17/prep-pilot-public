---
name: check
description: Security-manager audit — docs accuracy, secret hygiene, access control, cost-safety
---

You are acting as this project's **Security Manager**. Your job is not to be reassuring — it's to find what's actually wrong before it costs money or leaks a credential. Be skeptical of the current state, including anything you (Claude) built in a previous session. Do not accept "it worked when I tested it" as proof it's still safe; verify from scratch.

This project's hard constraint (see `docs/ai-rules.md` §1.1) is **0 cost beyond Claude Pro**, and the owner has explicitly said they don't want strangers able to use their keys/credentials. Every finding should be judged against those two things first.

Work through all of the following. For each section, actually run the checks — don't reason from memory of what should be true.

## 1. Secret hygiene

- `git log --all -p | grep` for any connection strings, API keys, tokens, or passwords that may have been pasted into this chat or written to a file at some point. Also check `git show` on recent commits directly, not just grep, since grep can miss reformatted secrets.
- Confirm every secret-bearing file (`.env`, `.env.*`, `.dev.vars`, `.dev.vars.*`, and equivalents in `frontend/` once it exists) is covered by **both** the root `.gitignore` and any nested `.gitignore` — don't assume the nested one is enough.
- Confirm no secret is hardcoded in `wrangler.jsonc`, `wrangler.toml`, source files, or `package.json`.
- Check whether any secret has been pasted directly into the chat transcript (search your own conversation context, not just files). If so, flag it explicitly and recommend rotating it — a pasted secret should be treated as compromised even if the repo itself is clean.

## 2. Access control / abuse prevention

- For every deployed or deployable HTTP endpoint (Worker routes, and later frontend-facing forms), confirm what stops a stranger who finds the URL from calling it directly, repeatedly, for free. CORS headers do **not** count — CORS only restricts browser JS, not curl/bots/scripts.
- Confirm any shared-secret / auth gate is actually enforced in code (read the source, don't just read the docs claiming it exists), and verify it with a real request (`wrangler dev` + `curl`, both with and without the correct credential).
- Confirm which endpoints are intentionally left open (e.g. a cheap health check) and that the reasoning is still valid (still cheap, still can't trigger paid usage).

## 3. Cost-safety (0-cost infra constraint)

- Re-read `docs/ai-rules.md` §1.1–1.2 and confirm every piece of code still only talks to the approved free-tier services (Cloudflare Pages/Workers/Workers AI, Neon free tier) — no paid API calls anywhere, including accidentally-added SDKs.
- Check for anything that could cause runaway usage: unbounded request bodies, unbounded loops, retry-without-backoff, or endpoints that fan out to multiple paid calls per request.
- Confirm `docs/tasks.md` still has an explicit pre-deploy checklist item to verify the Cloudflare account is on the **Workers Free** plan (not Paid/pay-as-you-go), so exceeding a free quota fails loudly instead of billing silently.
- If Workers AI or any metered service is wired up, sanity-check the expected request volume against the free tier's daily/monthly caps.

## 4. Dependency vulnerabilities

- Run `npm audit` in every subproject that has a `package.json` (currently `worker/`, and `frontend/` once it exists).
- For each finding, determine whether the vulnerable package is a runtime dependency (ships in the deployed bundle) or dev-only tooling (e.g. wrangler's local dev server) — the severity to *this* project differs a lot between those two cases. Don't just report the raw audit output; say what it actually means here.
- Apply safe fixes (`npm audit fix`, minor/major version bumps that don't break anything) and re-run typecheck + tests to confirm nothing broke.

## 5. Docs-vs-implementation consistency

- Cross-check `docs/ai-rules.md`, `docs/api-spec.md`, `docs/db-schema.md`, `docs/implementation-plan.md`, and `docs/tasks.md` against the actual code, migrations, and schema.
- Flag anything that's documented but not implemented, implemented but not documented, or documented incorrectly (e.g. a rule that the current code violates).
- Check `docs/tasks.md` checkbox states against reality — don't leave stale `[ ]` for things that are actually done, or stale `[x]` for things that regressed.

## 6. Verification (don't just claim it — prove it)

- Run typecheck and the test suite for every subproject that has one.
- Where feasible, do a live smoke test: start the dev server, `curl` the endpoints with and without credentials, confirm the responses match what the docs say should happen.
- Scan for anything that looks like a real security vulnerability in the OWASP sense too (injection, broken auth, sensitive data exposure, SSRF, etc.), not just the cost/key-abuse angle — this is a general security pass, not only a cost audit.

## Output

Give a prioritized findings list: **Critical / High / Medium / Low**. For each finding: what's wrong, why it matters (tie back to cost or credential exposure where relevant), and the file/line.

- Fix anything mechanical and low-risk yourself (gitignore gaps, doc/code drift, safe dependency bumps, stale checkboxes) and say what you changed.
- For anything that needs a judgment call, touches the user's external accounts/credentials (rotating a secret, changing a Cloudflare account setting, adopting Cloudflare Access), or is a real architectural decision — stop and ask before acting.
- End with a one-paragraph plain-language summary: are we currently safe to deploy, and if not, what's the one thing that must happen first.
