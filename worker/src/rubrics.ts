// docs/rubrics-amazon.json / docs/rubrics-make.json / docs/rubrics-meta.json
// are the single source of truth for scoring criteria per company (see
// docs/ai-rules.md §5.1) — imported directly rather than duplicated here.
import amazonRubrics from "../../docs/rubrics-amazon.json";
import makeRubrics from "../../docs/rubrics-make.json";
import metaRubrics from "../../docs/rubrics-meta.json";

export type Company = "amazon" | "make" | "meta";

// Loosely typed on purpose: the rubric JSON files have different
// subdimension keys per company (e.g. amazon_ecosystem_and_flywheel_fit vs.
// make_ecosystem_and_platform_fit vs. meta_ecosystem_and_network_effects_fit),
// so TypeScript's precise per-file resolveJsonModule types aren't
// structurally compatible with each other — this interface is just wide
// enough for the functions below to work with any of them.
interface RubricsFile {
	dimensions: Record<string, { name: string; subdimensions: Record<string, unknown> }>;
}

const RUBRICS_BY_COMPANY: Record<Company, RubricsFile> = {
	amazon: amazonRubrics,
	make: makeRubrics,
	meta: metaRubrics,
};

// Any company value that isn't a known rubric set (e.g. a stale/typo'd
// question row) falls back to Amazon's rubric rather than erroring — matches
// how the rest of the app already treats "amazon" as the default company.
function rubricsFor(company: string): RubricsFile {
	return RUBRICS_BY_COMPANY[company as Company] ?? amazonRubrics;
}

export function getSubdimensions(type: string, company: string = "amazon"): Record<string, unknown> | null {
	const dimension = rubricsFor(company).dimensions[type];
	return dimension ? dimension.subdimensions : null;
}

// Type labels (e.g. "Leadership Principles / Behavioral") are shared across
// companies — Amazon, Make, and Meta all use the same 7 generic PM types,
// identical text in all three files by construction — so this searches
// every known rubric file rather than assuming amazon's file has every
// type: a type only needs to exist in *one* file to get a label, regardless
// of which company introduced it.
const ALL_RUBRICS: RubricsFile[] = [amazonRubrics, makeRubrics, metaRubrics];

export function getTypeLabel(type: string): string {
	for (const rubrics of ALL_RUBRICS) {
		const dimension = rubrics.dimensions[type];
		if (dimension) return dimension.name;
	}
	return type;
}
