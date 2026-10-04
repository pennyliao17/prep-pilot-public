import type { Company } from "./types";

// Display copy of worker/src/prompts.ts's SALARY_BANDS (the server is the
// source of truth for what the coach actually uses; keep the two in sync).
// These are rough estimates read off public aggregators in October 2026 —
// not offers and not any company's real pay scale. Regions are Europe and the
// US. Within Europe, levels.fyi has no usable Prague PM data for Amazon or
// Meta, so both use London, where it has thousands of submissions.
export interface DisplayBand {
	roleLabel: string;
	cityLabel: string;
	currency: string;
	floor: number;
	ceiling: number;
	period: string;
	source: string;
}

export type SalaryRegion = "europe" | "us";

export const SALARY_REGION_OPTIONS: { value: SalaryRegion; label: string }[] = [
	{ value: "europe", label: "Europe" },
	{ value: "us", label: "United States" },
];

export const DISPLAY_BANDS: Record<Company, Record<SalaryRegion, DisplayBand>> = {
	amazon: {
		europe: {
			roleLabel: "Senior Product Manager (L6)",
			cityLabel: "London, United Kingdom",
			currency: "GBP",
			floor: 7_000,
			ceiling: 8_800,
			period: "gross base salary/month",
			source:
				"levels.fyi, Amazon L6 Product Manager in the UK: about GBP 94K base and GBP 133K total per year (the gap is back-loaded RSUs). The band is a range around the base figure.",
		},
		us: {
			roleLabel: "Senior Product Manager (L6)",
			cityLabel: "a major US tech hub",
			currency: "USD",
			floor: 14_000,
			ceiling: 16_500,
			period: "gross base salary/month",
			source:
				"levels.fyi, Amazon L6 Product Manager in the US: about USD 183K base and USD 297K total per year (the gap is back-loaded RSUs). The band is a range around the base figure.",
		},
	},
	make: {
		europe: {
			roleLabel: "Senior Product Manager",
			cityLabel: "Prague, Czech Republic",
			currency: "CZK",
			floor: 125_000,
			ceiling: 185_000,
			period: "gross/month",
			source:
				"levels.fyi, Senior Product Manager in Prague, 25th–75th percentile total compensation (CZK 1.46M–2.26M a year, only 12 submissions — low confidence), cross-checked against a handful of Make-specific Glassdoor submissions.",
		},
		us: {
			roleLabel: "Senior Product Manager (Celonis as a proxy)",
			cityLabel: "New York, United States",
			currency: "USD",
			floor: 15_000,
			ceiling: 19_000,
			period: "gross/month",
			source:
				"Make has almost no US pay data, so this uses its parent Celonis as a proxy: levels.fyi shows Celonis Product Manager total compensation in the US around USD 224K a year at the median (USD 168K–415K across levels). Low confidence.",
		},
	},
	meta: {
		europe: {
			roleLabel: "Product Manager (L6)",
			cityLabel: "London, United Kingdom",
			currency: "GBP",
			floor: 11_500,
			ceiling: 13_500,
			period: "gross base salary/month",
			source:
				"levels.fyi, Meta L6 Product Manager in the UK: about GBP 151K base and GBP 284K total per year (most of the gap is RSUs plus bonus). The band is a range around the base figure.",
		},
		us: {
			roleLabel: "Product Manager (L6)",
			cityLabel: "a major US tech hub",
			currency: "USD",
			floor: 20_000,
			ceiling: 23_500,
			period: "gross base salary/month",
			source:
				"levels.fyi, Meta L6 Product Manager in the US: about USD 261K base and USD 637K total per year (more than half is RSUs plus bonus). The band is a range around the base figure.",
		},
	},
};
