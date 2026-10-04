import PrepReader, { type PrepReaderSection } from "./PrepReader";
import { renderMarkdownLite } from "./markdownLite";
import { SYSTEM_DESIGN_GUIDE } from "./systemDesignGuideData";
import { ALL_DIAGRAMS } from "./systemDesignDiagrams";

// Static reference content (see systemDesignGuideData.ts) — no fetch, no
// loading/error state, so this component is just a data -> PrepReader
// mapping. Items with a diagram (see systemDesignDiagrams.tsx — cheat-sheet
// concepts, each worked example's architecture, RAG, batch inference, GPU
// cluster management) get it rendered above the prose: the diagram is a fast
// visual, the existing text explanation stays as the full, precise version
// underneath. Each item also gets a short reference-code badge (CS01, WE01,
// IN01 — one counter per section) and, when the data has one, a bilingual
// plain-language callout above the diagram.
const BADGE_PREFIX: Record<string, string> = {
	"cheat-sheet": "CS",
	"common-questions": "WE",
	"ai-llm-infra": "IN",
};

const SECTIONS: PrepReaderSection[] = SYSTEM_DESIGN_GUIDE.map((section) => ({
	id: section.id,
	title: section.title,
	meta: section.intro ? <p>{section.intro}</p> : undefined,
	items: section.items.map((item, index) => {
		const Diagram = ALL_DIAGRAMS[item.id];
		const prefix = BADGE_PREFIX[section.id] ?? "";
		return {
			id: item.id,
			label: item.label,
			badge: prefix ? `${prefix}${String(index + 1).padStart(2, "0")}` : undefined,
			searchText: item.body,
			body: (
				<>
					{item.eli5En && (
						<div className="sdg-eli5">
							<span className="sdg-eli5-label">Plain language</span>
							<p className="sdg-eli5-en">{item.eli5En}</p>
						</div>
					)}
					{Diagram && (
						<div className="sdg-diagram">
							<Diagram />
						</div>
					)}
					{renderMarkdownLite(item.body)}
				</>
			),
		};
	}),
}));

export default function SystemDesignGuide() {
	return (
		<div className="system-design-guide">
			<p className="knowledge-section-intro">
				A quick-reference cheat sheet, worked example answers, and AI/LLM infrastructure notes for system design
				interviews.
			</p>
			<PrepReader sections={SECTIONS} searchPlaceholder="Search this guide..." itemVariant="boxed" />
		</div>
	);
}
