import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
	// These tests hit real Neon on purpose (several sequential round trips per
	// test), so vitest's 5s default is too tight and a timeout mid-test is
	// exactly how test data gets left behind — see the comment in
	// test/index.spec.ts above retryable().
	test: { testTimeout: 30_000, hookTimeout: 30_000 },
});
