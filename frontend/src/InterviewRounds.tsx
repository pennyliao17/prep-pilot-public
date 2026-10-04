import { useEffect, useState } from "react";
import { getInterviewRounds } from "./api";
import { COMPANIES, type Company, type InterviewRound } from "./types";
import Dropdown from "./Dropdown";
import PrepReader, { type PrepReaderSection } from "./PrepReader";
import { renderMarkdownLite } from "./markdownLite";

const INTERVIEW_ROUNDS_COMPANY_STORAGE_KEY = "preppilot-interview-rounds-company";

function toReaderSections(rounds: InterviewRound[]): PrepReaderSection[] {
	return rounds.map((round) => {
		const meta = (
			<>
				{round.whatItTests && (
					<>
						<span className="knowledge-fact-label">What this round tests</span>
						{renderMarkdownLite(round.whatItTests)}
					</>
				)}
				{round.prepFocus && (
					<>
						<span className="knowledge-fact-label">Prep focus</span>
						{renderMarkdownLite(round.prepFocus)}
					</>
				)}
			</>
		);
		return {
			id: round.id,
			title: round.title,
			meta: round.whatItTests || round.prepFocus ? meta : undefined,
			items: round.qaItems.map((qa, i) => ({
				id: `${round.id}-qa-${i}`,
				label: qa.question,
				searchText: qa.answer,
				body: renderMarkdownLite(qa.answer),
			})),
		};
	});
}

export default function InterviewRounds() {
	const [company, setCompany] = useState<Company>(
		() => (localStorage.getItem(INTERVIEW_ROUNDS_COMPANY_STORAGE_KEY) as Company | null) ?? "amazon"
	);
	const [rounds, setRounds] = useState<InterviewRound[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setLoading(true);
		setError(null);
		getInterviewRounds(company)
			.then(setRounds)
			.catch((err: Error) => setError(err.message))
			.finally(() => setLoading(false));
	}, [company]);

	function handleCompanyChange(next: Company) {
		setCompany(next);
		localStorage.setItem(INTERVIEW_ROUNDS_COMPANY_STORAGE_KEY, next);
	}

	return (
		<PrepReader
			sections={toReaderSections(rounds)}
			loading={loading}
			loadingLabel="Loading interview rounds..."
			error={error}
			emptyMessage={`No interview round prep saved for ${COMPANIES.find((c) => c.value === company)?.label} yet.`}
			searchPlaceholder="Search this prep..."
			toolbar={
				<Dropdown
					label="Company"
					value={company}
					onChange={handleCompanyChange}
					options={COMPANIES.map((c) => ({ value: c.value, label: c.label }))}
				/>
			}
		/>
	);
}
