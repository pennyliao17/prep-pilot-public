// Static, hand-authored content for the demo/viewer account's "Interview
// Prep Guide" page — a sanitized, English-only stand-in for the real,
// DB-backed Interview Rounds feature (see InterviewRounds.tsx), which the
// demo account cannot reach because its real content is the owner's personal
// interview prep.
//
// This is generic interview-prep guidance for each supported company (what
// questions tend to come up per round, what to prepare, plus public-knowledge
// company facts), not a real candidate's answers. Nothing here comes from
// the owner's private notes.

import type { Company } from "./types";

export interface DemoGuideItem {
	id: string;
	label: string;
	body: string;
}

export interface DemoGuideSection {
	id: string;
	title: string;
	intro?: string;
	items: DemoGuideItem[];
}

interface RoundSpec {
	title: string;
	questions: string[];
	prep: string[];
}

interface CompanyGuideSpec {
	factIntro: string;
	facts: { id: string; label: string; body: string }[];
	rounds: RoundSpec[];
}

const VISA_FACT = {
	id: "visa",
	label: "Visa & relocation facts",
	body: "If the role requires relocation, research: whether the company sponsors a work visa, that country's typical visa processing time, and whether there is a signing bonus or relocation allowance. These are generic categories to fill in for your own situation before the call.",
};

const toBullets = (lines: string[]) => lines.map((line) => `- ${line}`).join("\n");

function buildGuide(company: Company, spec: CompanyGuideSpec): DemoGuideSection[] {
	return [
		{
			id: `${company}-fact-sheet`,
			title: "PART 0 — Fact Sheet",
			intro: spec.factIntro,
			items: spec.facts.map((fact) => ({ id: `${company}-fact-${fact.id}`, label: fact.label, body: fact.body })),
		},
		...spec.rounds.map((round, index) => ({
			id: `${company}-round-${index + 1}`,
			title: round.title,
			items: [
				{
					id: `${company}-round-${index + 1}-questions`,
					label: "Typical questions in this round",
					body: toBullets(round.questions),
				},
				{ id: `${company}-round-${index + 1}-prep`, label: "What to prepare", body: toBullets(round.prep) },
			],
		})),
	];
}

const AMAZON_SPEC: CompanyGuideSpec = {
	factIntro:
		"Before any round, build a one-page fact sheet on the company you are interviewing with. The example below uses Amazon: generic public-knowledge facts, not real prep notes.",
	facts: [
		{
			id: "company",
			label: "Company facts",
			body: "Amazon describes its mission as being Earth's most customer-centric company. Its main businesses are the retail marketplace (first- and third-party selling), Prime, AWS (cloud), advertising, devices and Alexa, and its logistics network. Competitors differ by business: Walmart and low-price marketplaces in retail, Microsoft and Google in cloud.",
		},
		{
			id: "recent",
			label: "Recent direction",
			body: "Expect AI to come up in every business line: generative AI assistants for shopping and voice, AI services and custom silicon inside AWS, and AI tools for advertisers. Also know the push toward faster delivery and the company's satellite internet effort. Read the latest earnings call or newsroom before the interview, since this changes quickly.",
		},
		{
			id: "teams",
			label: "How teams work",
			body: "- **Single-threaded leaders** own one problem end to end.\n- **Two-pizza teams** stay small enough to move quickly.\n- **Working Backwards** means writing the press release and FAQ before building.\n- **Six-page narrative memos** replace slide decks for big decisions.\n- A **Bar Raiser** from outside the hiring team joins the interview loop.",
		},
		{
			id: "flywheel",
			label: "The flywheel",
			body: "Lower costs allow lower prices, which bring more customers, which attract more sellers, which increases selection and improves the experience, which repeats. When you propose an idea in an interview, say whether it strengthens or strains this loop.",
		},
		VISA_FACT,
	],
	rounds: [
		{
			title: "ROUND 1 — HR / Recruiter Screen",
			questions: [
				"Tell me about yourself",
				"Why Amazon, and why this team or role",
				"Why are you leaving your current job",
				"Salary expectation",
				"Do you have any questions for me?",
			],
			prep: [
				"A 60–90 second career narrative that ends by pointing at *this* role.",
				"A reason for Amazon tied to a specific business and one leadership principle you genuinely relate to, not a recited list.",
				"A salary range you can state confidently — see the Salary Positioning tool below.",
				"Two or three genuine questions about the team and the interview loop.",
			],
		},
		{
			title: "ROUND 2 — Hiring Manager",
			questions: [
				"Walk me through your background",
				"Tell me about a project you owned end to end",
				"Tell me about a time you disagreed with a decision",
				"Tell me about a failure",
				"How do you prioritize?",
			],
			prep: [
				"Six to eight STAR stories, each of which can be mapped to several leadership principles.",
				"Say \"I\", not \"we\": the interviewer wants your own actions, with quantified results.",
				"Be ready to go two levels deeper on any decision you mention.",
				"A real failure with a real lesson, not a disguised success.",
			],
		},
		{
			title: "ROUND 3 — Product Sense & Analytical Case",
			questions: [
				"Improve a product you know well",
				"Design a feature for a specific customer segment",
				"How would you measure the success of this feature?",
				"A key metric dropped 15% — how do you investigate?",
			],
			prep: [
				"Start from the customer: clarify scope, name a segment, then the pain points, solutions, trade-offs, and metrics.",
				"One primary metric plus guardrail metrics, and a way to tell instrumentation problems from real behavior change.",
				"A structured breakdown of any drop (traffic, conversion, supply) before proposing fixes.",
				"Practice out loud; the structure matters as much as the answer.",
			],
		},
		{
			title: "ROUND 4 — Cross-functional & Behavioral Deep Dive",
			questions: [
				"Tell me about influencing without authority",
				"Tell me about a time you dove deep into the data or details",
				"Tell me about working with engineers on a hard trade-off",
				"Tell me about acting with incomplete information",
			],
			prep: [
				"Stories that show Dive Deep, Have Backbone / Disagree and Commit, Earn Trust, and Bias for Action, each with concrete evidence.",
				"Expect repeated follow-ups such as \"what exactly did you do?\" and \"what were the numbers?\".",
				"Keep stories consistent across interviewers; they compare notes.",
			],
		},
		{
			title: "ROUND 5 — Bar Raiser / Final Round",
			questions: [
				"Leadership-principle questions probed in depth",
				"Where could AI change one of Amazon's businesses?",
				"What would you do in your first 90 days?",
			],
			prep: [
				"The Bar Raiser looks for someone who raises the bar: be candid about weaknesses and show how you learned.",
				"A point of view on one Amazon business, with reasons and the risk you see.",
				"A 30/60/90-day skeleton: learn → ship something small → propose something bigger.",
				"Thoughtful questions for the interviewer.",
			],
		},
	],
};

const MAKE_SPEC: CompanyGuideSpec = {
	factIntro:
		"Before any round, build a one-page fact sheet on the company you are interviewing with. The example below uses Make (the workflow-automation platform) and Celonis (its parent company): generic public-knowledge facts, not real prep notes.",
	facts: [
		{
			id: "company",
			label: "Company facts",
			body: 'Make (formerly Integromat) is a visual, no-code/low-code workflow-automation platform: users build "scenarios" that connect apps and move data between them without writing code. Its main competitors are Zapier, n8n, and Workato.',
		},
		{
			id: "recent",
			label: "Recent direction",
			body: "Acquired by Celonis, shifting from a standalone automation tool toward being the execution layer inside Celonis's process-intelligence platform. Expect questions about how automation and AI-driven agents fit together, not just simple trigger-and-action workflows.",
		},
		{
			id: "primitives",
			label: "Core primitives",
			body: "Scenario (a workflow), Module (a single app's action or trigger), Connection (stored auth to a third-party app), Data store / Data structure (the schema for data passed between modules), Router/Filter (branching logic), Webhook.",
		},
		{
			id: "parent",
			label: "Why the parent company matters",
			body: "Celonis's core product is process mining: discovering how a business process actually runs by reading system logs. Make gives Celonis a way to act on what process mining finds, not just visualize the bottleneck. Expect at least one question connecting the two products.",
		},
		VISA_FACT,
	],
	rounds: [
		{
			title: "ROUND 1 — HR / Recruiter Screen",
			questions: [
				"Tell me about yourself",
				"Why this industry / why this location",
				"Why this company, and why now",
				"Why this role specifically",
				"Why are you leaving your current job",
				"Salary expectation",
				"Do you have any questions for me?",
			],
			prep: [
				"A 60–90 second career narrative that ends by pointing at *this* role, not one that trails off.",
				"One crisp, distinct sentence each for why-company / why-now / why-role, so you are not improvising three near-identical answers.",
				"A salary range you can state confidently — see the Salary Positioning tool below for a way to build one from your own numbers.",
				"Two or three genuine questions back for the recruiter.",
			],
		},
		{
			title: "ROUND 2 — Hiring Manager",
			questions: [
				"Walk me through your career",
				"A deep dive into your most relevant past project",
				"How did you decide what to prioritize or build first on that project?",
				"Tell me about a failure",
				"How do you work with engineers?",
				"Strengths / weaknesses",
			],
			prep: [
				"One flagship story in STAR form (Situation, Task, Action, Result) that you can stretch to 3 minutes or compress to 30 seconds.",
				'Be ready to go two levels deep on "why" for any decision you mention; hiring managers probe past the headline result.',
				"A genuine failure story with a real lesson, not a disguised success story.",
			],
		},
		{
			title: "ROUND 3 — Product Sense & Case",
			questions: [
				"What would you improve about our product?",
				"How would you prioritize between two possible features?",
				"How would you measure whether a feature succeeded?",
				"Where do AI agents fit versus deterministic, rule-based workflows?",
				"A live case or exercise",
			],
			prep: [
				"Pick one real, current feature of the product you have actually used and form a genuine opinion on it; interviewers can tell when you have not.",
				"A repeatable prioritization framework (for example reach × impact × confidence ÷ effort) and a success-metric habit (one primary metric, one guardrail).",
				"A point of view on the AI-agents-versus-deterministic-workflows question: this comes up often in automation-platform interviews right now.",
			],
		},
		{
			title: "ROUND 4 — Cross-functional & Team Fit",
			questions: [
				"Tell me about a disagreement with an engineer",
				"How do you handle a stakeholder pushing for something you disagree with?",
				"Working across time zones / remote / cross-culture",
				"General culture-fit questions",
			],
			prep: [
				"A conflict story where you changed your mind or changed theirs, not one where you were simply right and they were wrong.",
				"Concrete examples of how you make remote / async collaboration work (tools, rituals, written-communication habits).",
				"Know the company's stated values well enough to map one story to one of them without sounding scripted.",
			],
		},
		{
			title: "ROUND 5 — Final Round / Strategy",
			questions: [
				"Where should the company go in the next 1–3 years?",
				"What is the strongest counter-argument to the company's current strategy?",
				"What would you do in your first 90 days?",
			],
			prep: [
				"A point of view on company direction backed by one or two specific reasons, not vague enthusiasm.",
				"The ability to argue against your own recommendation for a minute if pushed; it shows you have stress-tested it.",
				"A simple 30/60/90-day skeleton: learn → ship something small → propose something bigger.",
			],
		},
	],
};

const META_SPEC: CompanyGuideSpec = {
	factIntro:
		"Before any round, build a one-page fact sheet on the company you are interviewing with. The example below uses Meta: generic public-knowledge facts, not real prep notes.",
	facts: [
		{
			id: "company",
			label: "Company facts",
			body: "Meta runs Facebook, Instagram, WhatsApp, Messenger, and Threads (its family of apps), plus Reality Labs (AR/VR and smart-glasses hardware) and the Meta AI assistant. Its stated mission is to give people the power to build community and bring the world closer together. Revenue comes mostly from advertising. Competitors include TikTok, YouTube, Snapchat, and X; in AI, OpenAI and Google.",
		},
		{
			id: "recent",
			label: "Recent direction",
			body: "Heavy investment in AI: the Meta AI assistant across its apps, open-weight Llama models, and AI-driven ranking and ad tools. Short-form video (Reels), Threads, and wearables are other areas to know. Reality Labs is funded by the profits of the ads business, a trade-off interviewers like to probe. Check the latest earnings call before the interview.",
		},
		{
			id: "surfaces",
			label: "Product surfaces and the metrics that matter",
			body: "Feed, Stories, Reels, Groups, Marketplace, and messaging. Typical metrics are daily active people, time spent, meaningful social interactions, and ad revenue per user. A PM is expected to reason about trade-offs among them, for example engagement versus well-being.",
		},
		{
			id: "values",
			label: "Culture and values",
			body: 'Themes from its 2012 IPO letter, "Move Fast", "Focus on Impact", "Be Bold", "Be Open", and "Build Social Value", plus "Meta, Metamates, Me" added in 2022. This is not an official numbered list; map your stories to the spirit of these themes, not to slogans.',
		},
		VISA_FACT,
	],
	rounds: [
		{
			title: "ROUND 1 — Recruiter Screen",
			questions: [
				"Tell me about yourself",
				"Why Meta, and why this product area",
				"Why are you leaving your current job",
				"Salary expectation",
				"Do you have any questions for me?",
			],
			prep: [
				"A 60–90 second career narrative that ends by pointing at *this* role.",
				"A reason for Meta tied to a specific product you use and have a real opinion about.",
				"Know the loop shape: product sense, execution, and leadership interviews are the common ones.",
				"A salary range you can state confidently — see the Salary Positioning tool below.",
			],
		},
		{
			title: "ROUND 2 — Hiring Manager / Leadership & Drive",
			questions: [
				"Tell me about the work you are proudest of and its impact",
				"Tell me about a time you made a bold call others disagreed with",
				"Tell me about a time you moved fast and shipped something imperfect",
				"Tell me about a failure and what you changed afterward",
				"How do you influence without authority?",
			],
			prep: [
				"Five or six stories with measurable impact; impact is how the culture judges work.",
				"Show ownership: what you chose, what risk you took, and what changed because of you.",
				"Be direct and open about mistakes; reflection counts as much as the result.",
			],
		},
		{
			title: "ROUND 3 — Product Sense",
			questions: [
				"How would you improve Reels or Groups?",
				"Design a feature to help people discover communities",
				"Who is the user, what is their problem, and why does it matter?",
			],
			prep: [
				"A repeatable structure: clarify, state the mission and goal, segment users and pick one, name the pain points, propose solutions, prioritize, then define metrics.",
				"Tie the answer to why it is good for people, not only for engagement.",
				"Form genuine opinions on two or three real Meta products before the interview.",
			],
		},
		{
			title: "ROUND 4 — Execution & Metrics",
			questions: [
				"How would you measure the success of a new feature?",
				"Daily actives on a product dropped 10% — how do you investigate?",
				"A change raised time spent but lowered meaningful interactions — what do you do?",
			],
			prep: [
				"A primary metric with guardrail metrics, and an explicit statement of what trade-off you accept.",
				"A layered investigation: instrumentation, product change, seasonality, external causes, then experiments to validate.",
				"Be ready to prioritize among several options and explain what you would do first and why.",
			],
		},
		{
			title: "ROUND 5 — Final Round / Strategy",
			questions: [
				"How should Meta compete with TikTok over the next three years?",
				"Where should Meta take its AI assistant next?",
				"What would you do in your first 90 days?",
			],
			prep: [
				"A point of view with specific reasons that accounts for the ads business, user trust, and regulation, not just growth.",
				"The ability to argue the opposite side for a minute if challenged.",
				"A simple 30/60/90-day skeleton: learn → ship something small → propose something bigger.",
			],
		},
	],
};

export const DEMO_INTERVIEW_GUIDE: Record<Company, DemoGuideSection[]> = {
	amazon: buildGuide("amazon", AMAZON_SPEC),
	make: buildGuide("make", MAKE_SPEC),
	meta: buildGuide("meta", META_SPEC),
};
