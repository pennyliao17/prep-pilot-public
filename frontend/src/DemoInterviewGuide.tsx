import { useMemo, useState } from "react";
import PrepReader, { type PrepReaderSection } from "./PrepReader";
import Dropdown from "./Dropdown";
import { renderMarkdownLite } from "./markdownLite";
import { DEMO_INTERVIEW_GUIDE } from "./demoInterviewGuideData";
import SalaryPositioningTool from "./SalaryPositioningTool";
import { COMPANIES, type Company } from "./types";

const DEMO_GUIDE_COMPANY_STORAGE_KEY = "preppilot-demo-guide-company";

function loadStoredCompany(): Company {
	try {
		const stored = localStorage.getItem(DEMO_GUIDE_COMPANY_STORAGE_KEY);
		if (COMPANIES.some((c) => c.value === stored)) return stored as Company;
	} catch {
		// localStorage can be unavailable (private windows); fall through to the default.
	}
	return "amazon";
}

// The demo/viewer account's stand-in for Interview Rounds — see
// demoInterviewGuideData.ts for why this is separate, static, sanitized
// content rather than a reuse of InterviewRounds.tsx (which fetches the
// real, personal DB-backed data). Deliberately does NOT call any
// interview-rounds API — this page is 100% static plus the one interactive
// Salary Positioning tool, which has its own separate, rate-limited backend
// route. The tool section keeps a constant id across companies, so whatever
// the viewer typed into it survives switching the company dropdown.
export default function DemoInterviewGuide() {
	const [company, setCompany] = useState<Company>(loadStoredCompany);

	function handleCompanyChange(next: Company) {
		setCompany(next);
		try {
			localStorage.setItem(DEMO_GUIDE_COMPANY_STORAGE_KEY, next);
		} catch {
			// Remembering the choice is a convenience only.
		}
	}

	const sections = useMemo<PrepReaderSection[]>(
		() => [
			...DEMO_INTERVIEW_GUIDE[company].map((section) => ({
				id: section.id,
				title: section.title,
				meta: section.intro ? <p>{section.intro}</p> : undefined,
				items: section.items.map((item) => ({
					id: item.id,
					label: item.label,
					searchText: item.body,
					body: renderMarkdownLite(item.body),
				})),
			})),
			{
				id: "salary-positioning",
				title: "Salary Positioning",
				meta: <p>Try the AI coach with your own numbers against an estimated band for the selected company — see below for details.</p>,
				items: [
					{
						id: "salary-positioning-tool",
						label: "Positioning tool",
						searchText: "salary positioning numbeo cost of living compensation negotiation",
						body: <SalaryPositioningTool company={company} />,
					},
				],
			},
		],
		[company]
	);

	return (
		<div className="demo-interview-guide">
			<p className="knowledge-section-intro">
				A sanitized, English-only example of interview prep for each company: what questions tend to come up per round and
				what to prepare — not a real candidate's real answers.
			</p>
			<PrepReader
				sections={sections}
				searchPlaceholder="Search this guide..."
				itemVariant="boxed"
				toolbar={
					<Dropdown
						label="Company"
						value={company}
						onChange={handleCompanyChange}
						options={COMPANIES.map((c) => ({ value: c.value, label: c.label }))}
					/>
				}
			/>
		</div>
	);
}
