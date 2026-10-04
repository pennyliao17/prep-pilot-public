import { useState } from "react";
import { COMPANY_KNOWLEDGE, type BusinessLine } from "./companyKnowledgeData";
import { COMPANIES, type Company } from "./types";
import Reveal from "./Reveal";
import Dropdown from "./Dropdown";

const COMPANY_KNOWLEDGE_STORAGE_KEY = "preppilot-company-knowledge-company";

export default function CompanyKnowledge() {
	const [company, setCompany] = useState<Company>(
		() => (localStorage.getItem(COMPANY_KNOWLEDGE_STORAGE_KEY) as Company | null) ?? "amazon"
	);
	const data = COMPANY_KNOWLEDGE[company];

	function handleCompanyChange(next: Company) {
		setCompany(next);
		localStorage.setItem(COMPANY_KNOWLEDGE_STORAGE_KEY, next);
	}

	return (
		<div className="company-knowledge">
			<Dropdown
				label="Company"
				value={company}
				onChange={handleCompanyChange}
				options={COMPANIES.map((c) => ({ value: c.value, label: c.label }))}
			/>

			<p className="company-knowledge-updated">Last updated {data.lastUpdated}</p>

			<section>
				<h2>Mission & flywheel</h2>
				<Reveal className="knowledge-card">
					<p className="knowledge-mission">{data.mission}</p>
					<p className="knowledge-flywheel">{data.flywheel}</p>
				</Reveal>
			</section>

			<section>
				<h2>Business lines</h2>
				<p className="knowledge-section-intro">
					What each business line actually optimizes for, the metrics a PM there would track, who they compete
					with, and a realistic question you could get asked about it.
				</p>
				<div className="knowledge-list">
					{data.businessLines.map((line) => (
						<BusinessLineCard key={`${company}:${line.name}`} line={line} />
					))}
				</div>
			</section>

			<section>
				<h2>Team structure & working norms</h2>
				<div className="knowledge-grid">
					{data.teamStructure.map((norm) => (
						<Reveal className="knowledge-card" key={norm.title}>
							<h3>{norm.title}</h3>
							<p className="knowledge-description">{norm.description}</p>
						</Reveal>
					))}
				</div>
			</section>

			<section>
				<h2>Recent news</h2>
				<div className="knowledge-grid">
					{data.recentNews.map((item) => (
						<Reveal className="knowledge-card" key={item.title}>
							<span className="question-tag">{item.date}</span>
							<h3>{item.title}</h3>
							<p className="knowledge-description">{item.summary}</p>
							<a href={item.source} target="_blank" rel="noreferrer" className="knowledge-source">
								Source
							</a>
						</Reveal>
					))}
				</div>
			</section>
		</div>
	);
}

function BusinessLineCard({ line }: { line: BusinessLine }) {
	return (
		<Reveal className="knowledge-card knowledge-line-card">
			<h3>{line.name}</h3>
			<p className="knowledge-description">{line.description}</p>

			<p className="knowledge-goal">
				<strong>PM angle:</strong> {line.pmGoal}
			</p>

			<div className="knowledge-line-facts">
				<div className="knowledge-fact">
					<span className="knowledge-fact-label">Key metrics</span>
					<ul className="knowledge-fact-list">
						{line.keyMetrics.map((m, i) => (
							<li key={i}>{m}</li>
						))}
					</ul>
				</div>
				<div className="knowledge-fact">
					<span className="knowledge-fact-label">Competes with</span>
					<ul className="knowledge-fact-list">
						{line.competitors.map((c, i) => (
							<li key={i}>{c}</li>
						))}
					</ul>
				</div>
			</div>

			<div className="knowledge-sample-questions">
				<span className="knowledge-fact-label">Sample questions</span>
				{line.sampleQuestions.map((qa, i) => (
					<details className="knowledge-sample-answer" key={i}>
						<summary>{qa.question}</summary>
						<div className="knowledge-answer-steps">
							{qa.answerSteps.map((step, j) => (
								<p key={j}>
									<strong>{step.label}:</strong> {step.content}
								</p>
							))}
						</div>
					</details>
				))}
			</div>
		</Reveal>
	);
}
