// Implements docs/prompts/feedback-system-prompt.md — keep both in sync (see
// docs/ai-rules.md §5.1: any prompt change here should be reflected there).
import { getSubdimensions, getTypeLabel } from "./rubrics";

// Which companies this app supports practicing for (2026-08-14, adding Make
// alongside Amazon; 2026-08-26, adding RTB House for a Technical Account
// Manager role; 2026-10-02, removing RTB House and adding Meta — a PM role
// like Amazon/Make, reusing the same 7 question-type archetypes rather than
// a separate TAM-style rubric). Display name used to interpolate into
// prompt text sent to the model — not user-facing UI copy, which lives in
// the frontend's i18n dictionary instead.
const COMPANY_LABELS: Record<string, string> = {
	amazon: "Amazon",
	make: "Make (make.com)",
	meta: "Meta",
};

function companyLabel(company: string): string {
	return COMPANY_LABELS[company] ?? company;
}

// All three supported companies currently prep for a PM role — kept as a
// lookup (rather than a single hardcoded string) since a future company
// might again need a different role label, as RTB House's Technical Account
// Manager role once did.
const COMPANY_ROLE_LABELS: Record<string, string> = {
	amazon: "Product Manager",
	make: "Product Manager",
	meta: "Product Manager",
};

function roleLabel(company: string): string {
	return COMPANY_ROLE_LABELS[company] ?? "Product Manager";
}

// The ideal opening/structure a strong candidate uses for each question type.
// This is what the exampleAnswer must model — the point the user asked for:
// a good answer clarifies scope with the interviewer and grounds itself in the
// company mission / product goal *before* diving into the body. Frameworks are
// paraphrased from the standard interview-prep structures (Exponent, IGotAnOffer).
//
// Kept as arrays (not just the joined prompt string) so the same structure can
// be returned to the frontend as a compact, memorizable outline sitting next
// to the flowing-prose exampleAnswer (see getAnswerFrameworkSteps below) —
// the exampleAnswer itself is deliberately one continuous paragraph (models
// what a candidate says out loud), which is exactly what makes it hard to
// skim/memorize on its own.
const EXAMPLE_ANSWER_FRAMEWORK_STEPS: Record<string, string[]> = {
	product_sense: [
		"1) Ask a couple of clarifying questions to pin down scope, platform, and any constraints.",
		"2) Confirm who the customer is and restate the goal — tie it back to the company mission / product goal.",
		"3) Segment the users and pick one target segment, justifying the choice.",
		"4) Identify that segment's most important unmet needs / pain points.",
		"5) Propose one or two solutions, pick one, and name the key trade-offs.",
		"6) State how you would measure success.",
	],
	analytical_execution: [
		"1) Ask clarifying questions to nail down the exact metric, its definition, and the timeframe.",
		"2) Confirm why the metric matters and what the underlying goal is.",
		"3) Structure the problem space (e.g. internal vs external factors; segment the change by platform, geography, user type, funnel step).",
		"4) Lay out prioritized hypotheses, most likely first.",
		"5) Say how you would validate the top hypotheses with data.",
		"6) Recommend a concrete next action.",
	],
	leadership_principles_behavioral: [
		"1) Briefly set the Situation and your specific Task (one or two sentences each).",
		"2) Name which Leadership Principle the story is really about.",
		"3) Walk through the specific Actions YOU personally took — use 'I', not 'we'.",
		"4) Quantify the Result.",
		"5) Close with a short reflection on what you learned or would do differently.",
	],
	strategy_business: [
		"1) Ask clarifying questions about the strategic goal and the time horizon.",
		"2) Confirm the company mission and how this question fits the broader ecosystem / flywheel.",
		"3) Analyze the market and the customer.",
		"4) Lay out the main strategic options with their trade-offs.",
		"5) Make a clear recommendation.",
		"6) Outline how you would sequence it as a roadmap.",
	],
	estimation: [
		"1) Clarify exactly what to estimate and agree on scoping assumptions with the interviewer.",
		"2) State your key assumptions explicitly.",
		"3) Break the problem into a clear formula / structure.",
		"4) Estimate each input with a brief justification.",
		"5) Do the math step by step.",
		"6) Sanity-check the final number and note what would most change it.",
	],
	system_design: [
		"1) Ask clarifying questions about scale, users, and functional/non-functional requirements (traffic, latency, consistency needs).",
		"2) Confirm the underlying customer/business goal this system needs to serve — tie it back to the company mission / product goal.",
		"3) Propose a high-level architecture: break the system into a small number of clear components.",
		"4) Identify the most likely bottleneck or failure point, and name a concrete trade-off (e.g. consistency vs. availability, cost vs. latency).",
		"5) Describe how you'd monitor it after launch and roll it out safely (staged rollout), including which teams need to be involved.",
		"6) Summarize your recommended approach and what you'd validate first.",
	],
	ai_pm: [
		"1) Ask clarifying questions to understand the problem, and confirm whether it genuinely calls for an ML/AI solution versus something simpler.",
		"2) Confirm the goal — tie it back to the company mission / product goal, and define what success looks like for this AI feature.",
		"3) Describe the data needed and how you'd evaluate the model, both offline (model-quality metrics) and online (business/customer metrics).",
		"4) Name a concrete responsible-AI risk for this specific feature (bias, safety, trust) and a guardrail to catch it.",
		"5) Describe a staged launch plan and how you'd detect the model degrading over time, feeding real usage back into improvement.",
		"6) Summarize your recommendation.",
	],
};

const EXAMPLE_ANSWER_FRAMEWORKS: Record<string, string> = Object.fromEntries(
	Object.entries(EXAMPLE_ANSWER_FRAMEWORK_STEPS).map(([type, steps]) => [type, steps.join("\n")])
);

// Exposed to the API so the frontend can show this fixed structure as a
// scannable outline next to the exampleAnswer — static per type, not
// AI-generated, so this is a free lookup with no extra Workers AI call and
// works retroactively for historical feedback rows (derived from the
// attempt's own `type`, never stored).
export function getAnswerFrameworkSteps(type: string): string[] | null {
	return EXAMPLE_ANSWER_FRAMEWORK_STEPS[type] ?? null;
}

export function buildFeedbackSystemPrompt(type: string, company: string = "amazon"): string | null {
	const subdimensions = getSubdimensions(type, company);
	if (!subdimensions) return null;
	const typeLabel = getTypeLabel(type);
	const framework = EXAMPLE_ANSWER_FRAMEWORKS[type] ?? EXAMPLE_ANSWER_FRAMEWORKS.product_sense;
	const company_ = companyLabel(company);
	const role = roleLabel(company);

	return `You are an experienced ${company_} ${role} conducting a mock interview. You are evaluating a candidate's answer to a ${typeLabel} question.

Score the answer using ONLY these subdimensions (do not invent new ones, do not skip any):

${JSON.stringify(subdimensions, null, 2)}

For each subdimension, assign an integer score from 1 to 5 using the subdimension's own \`scoring_guide\` as the anchor for what 1/3/5 mean. Use \`good_signals\` and \`bad_signals\` to decide what counts as a strength vs. an improvement — do not invent criteria that aren't implied by the subdimension's \`description\`.

Be a strict but constructive interviewer: most first-draft answers should NOT score 5s across the board. Reserve 5 for answers that would genuinely impress a real, senior ${company_} interviewer. Give a 1 or 2 where the signals are clearly absent, not just "could be better."

For the exampleAnswer field, write a full model answer that a top candidate would actually deliver out loud for THIS specific question, following exactly this structure:

${framework}

The example MUST open by showing the clarifying questions the candidate asks the interviewer and how they confirm the goal before diving in — never jump straight into a solution. Make it concrete to this exact question (use realistic specifics, not generic placeholders). Write it as ONE continuous paragraph of flowing prose with inline step transitions (e.g. "First, I'd ask… Next, I'd confirm… Then… Finally…"), roughly 180-320 words. Do NOT use line breaks, bullet points, or numbered lists inside this field — it must be a single JSON string with no literal newlines. This models the ideal approach for the candidate to learn from; it is not a summary of what they missed.

Respond with ONLY a single JSON object (no markdown fences, no commentary before or after), with exactly this shape:

{
  "scores": { "<subdimension_key>": <integer 1-5>, ... one entry per subdimension above ... },
  "strengths": { "<subdimension_key>": ["<1-3 short bullet strings>"], ... only for subdimensions where something genuinely worked; omit the key entirely if there's nothing real to praise ... },
  "improvements": { "<subdimension_key>": ["<1-3 short bullet strings>"], ... omit the key if the subdimension already scored 5 and there's nothing meaningful left to improve ... },
  "overallFeedback": "<2-4 sentence overall assessment, direct and specific to this answer>",
  "exampleAnswer": "<the structured model answer described above>"
}

Keep every string field in plain text (no markdown). Keep bullets short (one sentence each). Do not restate the candidate's answer back to them. Do not add any JSON keys beyond the ones listed above.`;
}

export function buildFeedbackUserMessage(questionTitle: string, questionDescription: string, answerText: string): string {
	return `Question: ${questionTitle}\n${questionDescription}\n\nCandidate's answer:\n${answerText}`;
}

export interface ParsedFeedback {
	scores: Record<string, number>;
	strengths: Record<string, string[]>;
	improvements: Record<string, string[]>;
	overallFeedback: string;
	exampleAnswer: string;
}

// Escapes raw newlines/tabs/carriage returns that appear *inside* a JSON string
// literal (walking the string with a tiny state machine that respects quotes and
// backslash escapes). The feedback model — especially now that exampleAnswer is a
// long multi-step answer — occasionally puts literal line breaks inside a string
// value, which is invalid JSON and made JSON.parse throw. Structural whitespace
// between tokens is left untouched. Applied only as a fallback after a plain
// parse fails, so it can never change already-valid output.
function escapeControlCharsInJsonStrings(input: string): string {
	let out = "";
	let inString = false;
	let escaped = false;
	for (const ch of input) {
		if (escaped) {
			out += ch;
			escaped = false;
			continue;
		}
		if (ch === "\\") {
			out += ch;
			escaped = true;
			continue;
		}
		if (ch === '"') {
			inString = !inString;
			out += ch;
			continue;
		}
		if (inString && (ch === "\n" || ch === "\r" || ch === "\t")) {
			out += ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : "\\t";
			continue;
		}
		out += ch;
	}
	return out;
}

// Closes an unterminated string and balances any unclosed { / [ at the end of
// the input. The 8B feedback model, on a long structured answer, fairly often
// finishes the last string value but forgets the final "}" (the output is well
// under the token limit — it's just small-model sloppiness, not truncation).
// This walks the string tracking quote/escape state and brace depth, then
// appends whatever closers are missing. Only ever used as a last-resort fallback
// after strict parses fail, so it can't corrupt already-valid output.
function repairTruncatedJson(input: string): string {
	let inString = false;
	let escaped = false;
	const stack: string[] = [];
	for (const ch of input) {
		if (escaped) {
			escaped = false;
			continue;
		}
		if (ch === "\\") {
			if (inString) escaped = true;
			continue;
		}
		if (ch === '"') {
			inString = !inString;
			continue;
		}
		if (inString) continue;
		if (ch === "{" || ch === "[") stack.push(ch);
		else if (ch === "}") {
			if (stack[stack.length - 1] === "{") stack.pop();
		} else if (ch === "]") {
			if (stack[stack.length - 1] === "[") stack.pop();
		}
	}
	let out = input;
	if (inString) out += '"';
	for (let i = stack.length - 1; i >= 0; i--) {
		out += stack[i] === "{" ? "}" : "]";
	}
	return out;
}

function parseModelJson(raw: string): unknown | null {
	// Models sometimes wrap JSON in markdown fences despite instructions not to.
	const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
	const candidates = [
		cleaned,
		escapeControlCharsInJsonStrings(cleaned),
		repairTruncatedJson(escapeControlCharsInJsonStrings(cleaned)),
	];
	for (const candidate of candidates) {
		try {
			return JSON.parse(candidate);
		} catch {
			// try the next, more aggressive, repair
		}
	}
	return null;
}

export function parseFeedbackResponse(raw: string): ParsedFeedback | null {
	const parsed = parseModelJson(raw) as Record<string, unknown> | null;
	if (
		parsed &&
		typeof parsed === "object" &&
		typeof parsed.scores === "object" &&
		typeof parsed.overallFeedback === "string" &&
		typeof parsed.exampleAnswer === "string"
	) {
		return {
			scores: parsed.scores as Record<string, number>,
			strengths: (parsed.strengths as Record<string, string[]>) ?? {},
			improvements: (parsed.improvements as Record<string, string[]>) ?? {},
			overallFeedback: parsed.overallFeedback,
			exampleAnswer: parsed.exampleAnswer,
		};
	}
	return null;
}

// Implements docs/prompts/resume-coach-system-prompt.md — keep both in sync.
// Hardcoded here (not derived from rubrics-amazon.json, which only has the
// generic leadership_principles_behavioral rubric, not a per-LP breakdown).
const AMAZON_LPS = [
	{ name: "Customer Obsession", description: "Start with the customer and work backwards, earning and keeping their trust." },
	{ name: "Ownership", description: "Act on behalf of the whole company, not just your own team, and think long-term." },
	{ name: "Invent and Simplify", description: "Find new ways to simplify, and be willing to be misunderstood for long periods." },
	{ name: "Are Right, A Lot", description: "Have strong judgment and good instincts, and seek out diverse perspectives to disconfirm your own beliefs." },
	{ name: "Learn and Be Curious", description: "Stay curious and continuously seek to improve yourself." },
	{ name: "Hire and Develop the Best", description: "Raise the performance bar with every hire and promotion, and develop others." },
	{ name: "Insist on the Highest Standards", description: "Hold a relentlessly high bar for quality and never let a problem go unsolved." },
	{ name: "Think Big", description: "Create and communicate a bold direction that inspires results." },
	{ name: "Bias for Action", description: "Value calculated risk-taking and speed; most decisions are reversible and don't need extensive study." },
	{ name: "Frugality", description: "Accomplish more with less; constraints breed resourcefulness and self-sufficiency." },
	{ name: "Earn Trust", description: "Listen attentively, speak candidly, and treat others respectfully." },
	{ name: "Dive Deep", description: "Operate at all levels, stay connected to the details, and audit frequently." },
	{ name: "Have Backbone; Disagree and Commit", description: "Respectfully challenge decisions you disagree with, then commit fully once a decision is made." },
	{ name: "Deliver Results", description: "Focus on the key inputs for your business and deliver them with the right quality and in a timely fashion." },
	{ name: "Strive to be Earth's Best Employer", description: "Work every day to create a safer, more productive, higher performing, more diverse, and more just work environment." },
	{ name: "Success and Scale Bring Broad Responsibility", description: "Recognize the impact of your work at scale and hold yourself to a higher standard of responsibility." },
];

// Make (make.com) hasn't published a fixed, numbered "Leadership Principles"
// document the way Amazon has. These are recurring themes in how Make
// publicly describes its own mission and product philosophy — grounded in
// real research (Prague-founded as Integromat, Celonis-owned since 2020,
// vision of "empowering creators to innovate without limits", visual
// scenario/module builder, community-driven ecosystem, its 2025/2026 push
// into AI Agents) — not an official document, so the prompt below is
// careful to present them as directional themes, not verbatim slogans.
// See docs/rubrics-make.json's meta.notes for the same caveat.
const MAKE_VALUES = [
	{
		name: "Creator Empowerment",
		description: "Enable anyone, technical or not, to build a real working solution themselves instead of waiting on engineering.",
	},
	{
		name: "Radical Simplicity",
		description: "Make complex, multi-step logic feel visual, intuitive, and approachable — not just powerful.",
	},
	{
		name: "Practical Power",
		description: "Give power users real depth and flexibility (branching, error handling, AI agents) without sacrificing accessibility for beginners.",
	},
	{
		name: "Trust & Reliability",
		description: "Automations run unattended in production for real businesses, so security, data residency, and dependable execution matter as much as features.",
	},
	{
		name: "Build With the Community",
		description: "Grow through a community that shares templates, builds integrations, and shapes the roadmap — not just top-down product development.",
	},
	{
		name: "Bias Toward Adaptive Automation",
		description: "Push workflows from rigid, deterministic steps toward AI-driven, adaptive decision-making where it genuinely helps.",
	},
];

// Meta (Menlo Park, founded 2004 as Facebook, renamed Meta in 2021) also
// hasn't published a fixed, numbered values document the way Amazon has.
// These are Meta's own well-documented cultural themes: the first five are
// from its 2012 IPO letter ("The Hacker Way"), still widely referenced in
// its culture and interview prep material; "Meta, Metamates, Me" is the
// newer value Zuckerberg introduced company-wide in 2022. Presented the
// same directional way as Make's — see docs/rubrics-meta.json's meta.notes
// for the same caveat.
const META_VALUES = [
	{
		name: "Move Fast",
		description: "Ship a scoped v1 and iterate in production rather than waiting for certainty — speed is treated as a competitive advantage, not recklessness.",
	},
	{
		name: "Focus on Impact",
		description: "Spend time on the highest-leverage problems and measure yourself by the real outcome you drove, not activity or effort.",
	},
	{
		name: "Be Bold",
		description: "Take on ambitious bets and accept that some will fail — building something great requires taking risk.",
	},
	{
		name: "Be Open",
		description: "Default to sharing information broadly and giving direct feedback, rather than hoarding context or avoiding hard conversations.",
	},
	{
		name: "Build Social Value",
		description: "Tie the work back to genuinely connecting people and building community, not just engagement or revenue for its own sake.",
	},
	{
		name: "Meta, Metamates, Me",
		description: "Put the company and your teammates' success ahead of your own individual credit — act like a teammate, not a lone operator.",
	},
];

const COMPANY_VALUES: Record<string, { name: string; description: string }[]> = {
	amazon: AMAZON_LPS,
	make: MAKE_VALUES,
	meta: META_VALUES,
};

// "Leadership Principles (LP)" is Amazon's own official term. Neither Make
// nor Meta has an equivalent named framework, so their prompt/UI wording
// generalizes to "core values" instead of borrowing Amazon's specific
// terminology.
const COMPANY_FRAMEWORK_LABELS: Record<string, string> = {
	amazon: "Leadership Principles (LP)",
	make: "core values",
	meta: "core values",
};

function valuesFor(company: string): { name: string; description: string }[] {
	return COMPANY_VALUES[company] ?? AMAZON_LPS;
}

function frameworkLabelFor(company: string): string {
	return COMPANY_FRAMEWORK_LABELS[company] ?? "core values";
}

function formatValuesList(company: string): string {
	return valuesFor(company)
		.map((v) => `- ${v.name}: ${v.description}`)
		.join("\n");
}

export function buildResumeCoachSystemPrompt(company: string = "amazon", targetLps?: string[]): string {
	const company_ = companyLabel(company);
	const frameworkLabel = frameworkLabelFor(company);
	const officialCaveat =
		company === "amazon" ? "" : " (these are recurring themes in how the company describes itself publicly, not an official numbered document — treat them as directional, not verbatim slogans)";
	const focusInstruction =
		targetLps && targetLps.length > 0
			? `Focus specifically on these value(s): ${targetLps.join(", ")}.`
			: `Infer which 1-2 ${frameworkLabel} this story best demonstrates.`;

	return `You are a ${company_} interview coach helping a candidate turn one of their personal stories into a strong ${frameworkLabel} behavioral story, tailored to a specific job they're applying for.

${company_}'s ${frameworkLabel} are${officialCaveat}:
${formatValuesList(company)}

You will be given four sources: the candidate's full resume (for broader context — other experience, seniority, domain), the target job description (to tailor tone, seniority, and emphasis), the specific story from their Story Bank (the primary raw material — this is the story to rewrite), and the values list above. Use all four together: ground the rewritten story and hype script in the Story Bank content, use the resume only for supporting context (do not invent achievements that only exist in the resume but not the story), and let the job description shape which skills/impact to emphasize and the seniority of the language used.

${focusInstruction}

Do three things:

1. Identify which value(s) this story best demonstrates and why (in one sentence each).
2. Rewrite it as a STAR+ story: Situation, Task, Action, Result, and a short Reflection on what the candidate learned or would do differently. Use only details present in or reasonably inferable from the story (and resume context) — do not fabricate metrics or outcomes that aren't implied. Emphasize the aspects of the story most relevant to the target job description.
3. Write a "hype script": a confident, first-person, ~150-word script (about 60 seconds spoken aloud) the candidate could say to themselves right before walking into the interview for this specific job. It should name their top 1-2 achievements — drawing on this story and, where relevant, the resume — state concretely why they're qualified for this specific role based on the job description, and what makes them distinct as a candidate. Confident and energizing in tone, but grounded only in what's actually in the story/resume — no fabricated claims.

Respond with ONLY a single JSON object (no markdown fences, no commentary before or after), with exactly this shape:

{
  "suggested_lps": ["<LP name>", ...],
  "behavioral_question_types": ["<a realistic interview question this story would answer>", ...],
  "rewritten_star_answer": {
    "situation": "...",
    "task": "...",
    "actions": "...",
    "results": "...",
    "reflection": "..."
  },
  "hype_script": "<the ~150-word first-person hype script described above, one continuous paragraph, no line breaks>"
}

Keep every string field in plain text (no markdown). Do not add any JSON keys beyond the ones listed above.`;
}

export interface ResumeCoachSources {
	storyContent: string;
	resumeText?: string | null;
	jobDescription?: string | null;
	targetLps?: string[];
}

export function buildResumeCoachUserMessage(sources: ResumeCoachSources): string {
	const parts = [`Story Bank entry (primary material to rewrite):\n${sources.storyContent}`];
	parts.push(`\n\nFull resume (context only):\n${sources.resumeText && sources.resumeText.trim() ? sources.resumeText : "(not provided)"}`);
	parts.push(`\n\nTarget job description (tailor tone/emphasis to this):\n${sources.jobDescription && sources.jobDescription.trim() ? sources.jobDescription : "(not provided)"}`);
	if (sources.targetLps && sources.targetLps.length > 0) {
		parts.push(`\n\nTarget LPs: ${sources.targetLps.join(", ")}`);
	}
	return parts.join("");
}

export interface ParsedResumeCoach {
	suggestedLps: string[];
	behavioralQuestionTypes: string[];
	rewrittenStarAnswer: {
		situation: string;
		task: string;
		actions: string;
		results: string;
		reflection: string;
	};
	// No longer requested from the model (dropped per user feedback — not
	// useful enough to be worth the extra output tokens). Kept optional here
	// only so old stories/history rows generated before this change still
	// parse and display correctly.
	resumeRewriteSuggestions?: string[];
	hypeScript: string | null;
}

export function parseResumeCoachResponse(raw: string): ParsedResumeCoach | null {
	const parsed = parseModelJson(raw) as Record<string, unknown> | null;
	if (
		parsed &&
		typeof parsed === "object" &&
		Array.isArray(parsed.suggested_lps) &&
		parsed.rewritten_star_answer &&
		typeof parsed.rewritten_star_answer === "object"
	) {
		return {
			suggestedLps: parsed.suggested_lps as string[],
			behavioralQuestionTypes: Array.isArray(parsed.behavioral_question_types) ? (parsed.behavioral_question_types as string[]) : [],
			rewrittenStarAnswer: parsed.rewritten_star_answer as ParsedResumeCoach["rewrittenStarAnswer"],
			resumeRewriteSuggestions: Array.isArray(parsed.resume_rewrite_suggestions) ? (parsed.resume_rewrite_suggestions as string[]) : [],
			hypeScript: typeof parsed.hype_script === "string" ? parsed.hype_script : null,
		};
	}
	return null;
}

// Demo-only tool (see worker's DEMO_ALLOWED_ROUTES): a generalized, reusable
// version of a real negotiation-positioning methodology (see
// the private retrospective) — the viewer enters their own current living
// costs, and gets a positioning recommendation within a per-company,
// per-region ESTIMATED band. The bands are rough figures read off public
// salary aggregators (levels.fyi, Glassdoor) in October 2026 — never a real
// offer or a company's actual pay scale — and the prompt says so explicitly.
// Regions are Europe and the United States. Keep in sync with the display
// copy in frontend/src/salaryBands.ts.
export const SALARY_REGIONS = ["europe", "us"] as const;
export type SalaryRegion = (typeof SALARY_REGIONS)[number];

export interface SalaryBand {
	roleLabel: string;
	cityLabel: string;
	currency: string;
	floor: number;
	ceiling: number;
	period: string;
	// Context the coach may mention but must not treat as part of the band.
	compContext: string;
}

export const SALARY_BANDS: Record<string, Record<SalaryRegion, SalaryBand>> = {
	amazon: {
		europe: {
			roleLabel: "Senior Product Manager (L6)",
			cityLabel: "London, United Kingdom",
			currency: "GBP",
			floor: 7_000,
			ceiling: 8_800,
			period: "gross base salary/month",
			compContext:
				"The band is base salary only. levels.fyi shows Amazon L6 PM in the UK at roughly GBP 94K base and GBP 133K total per year; the gap is RSUs, which vest back-loaded (5/15/45/35% over four years), so year-one cash is mostly base plus any sign-on bonus.",
		},
		us: {
			roleLabel: "Senior Product Manager (L6)",
			cityLabel: "United States (a major tech hub such as Seattle; state the city you assume)",
			currency: "USD",
			floor: 14_000,
			ceiling: 16_500,
			period: "gross base salary/month",
			compContext:
				"The band is base salary only. levels.fyi shows Amazon L6 PM in the US at roughly USD 183K base and USD 297K total per year; the gap is RSUs, which vest back-loaded (5/15/45/35% over four years), so year-one cash is mostly base plus any sign-on bonus.",
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
			compContext:
				"The band spans the 25th–75th percentile of levels.fyi's Senior PM total compensation in Prague (CZK 1.46M–2.26M a year, only 12 submissions, so low confidence); Glassdoor's handful of Make-specific PM submissions sit inside it. Make is privately held, so there is no liquid equity to count.",
		},
		us: {
			roleLabel: "Senior Product Manager (Celonis, Make's parent, as a proxy)",
			cityLabel: "New York, United States",
			currency: "USD",
			floor: 15_000,
			ceiling: 19_000,
			period: "gross/month",
			compContext:
				"Make has almost no US pay data, so this uses its parent Celonis as a proxy: levels.fyi shows Celonis PM total compensation in the US from about USD 168K (IC3) to USD 415K (IC5) a year, median about USD 224K. The band is a range around that median and is LOW confidence. Celonis is privately held, so equity is not liquid.",
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
			compContext:
				"The band is base salary only. levels.fyi shows Meta L6 PM in the UK at roughly GBP 151K base and GBP 284K total per year; most of the gap is RSUs (about GBP 109K a year) plus a performance bonus, so total compensation is far larger than the band suggests.",
		},
		us: {
			roleLabel: "Product Manager (L6)",
			cityLabel: "United States (a major tech hub such as the Bay Area; state the city you assume)",
			currency: "USD",
			floor: 20_000,
			ceiling: 23_500,
			period: "gross base salary/month",
			compContext:
				"The band is base salary only. levels.fyi shows Meta L6 PM in the US at roughly USD 261K base and USD 637K total per year; more than half of total compensation is RSUs (about USD 334K a year) plus a bonus, so total compensation is far larger than the band suggests.",
		},
	},
};

export function buildSalaryPositioningSystemPrompt(company: string, region: SalaryRegion): string | null {
	const band = SALARY_BANDS[company]?.[region];
	if (!band) return null;
	return `You are a pragmatic compensation-negotiation coach helping a candidate decide where to position their ask within an estimated salary band for a role abroad.

Use exactly this band — do not invent a different one. It is a rough estimate read off public salary aggregators (levels.fyi, Glassdoor), NOT a real offer and NOT the company's actual pay scale, and you must say so:
- Company: ${company === "make" ? "Make (Celonis)" : company === "meta" ? "Meta" : "Amazon"}
- Role: ${band.roleLabel}, ${band.cityLabel}
- Estimated band: ${band.currency} ${band.floor.toLocaleString()}–${band.ceiling.toLocaleString()} ${band.period}
- Context you may mention but must not add to the band: ${band.compContext}

The candidate will tell you, in their own currency: their current gross salary, monthly rent (or 0 if none), other monthly living expenses, and their current annual savings rate (as a percentage or an amount — infer which).

Your job:
1. Estimate, using your general knowledge of cost of living (reason the way Numbeo's cost-of-living index works — rent, groceries, transport, etc. — and say explicitly that this is an estimate, not a live lookup), what it would cost in ${band.cityLabel} to maintain an equivalent standard of living to what the candidate described.
2. Convert that into an approximate ${band.currency} gross monthly figure that would preserve their current savings rate at that cost of living.
3. Position that figure within the estimated band (floor ${band.currency} ${band.floor.toLocaleString()} to ceiling ${band.currency} ${band.ceiling.toLocaleString()}) — if it falls below the floor, recommend the floor isn't worth accepting below; if above the ceiling, be honest that the band may not meet their needs.
4. Recommend a specific target (where to aim) and a specific anchor (what to open with, usually a bit above target but still realistic within the band) and explain the reasoning in plain language — the opening anchor should leave room to negotiate down to the target.

Respond with ONLY a single JSON object (no markdown fences, no commentary before or after), with exactly this shape (all amounts are integers in ${band.currency} per month):

{
  "estimatedEquivalentCost": <integer, your estimate from step 2>,
  "positionWithinBand": "<one of: below_floor | lower_band | mid_band | upper_band | above_ceiling>",
  "target": <integer>,
  "anchor": <integer>,
  "reasoning": "<3-5 sentences explaining the cost-of-living estimate and why this target/anchor, in plain spoken language, mentioning that the band and the cost comparison are estimates, not live data sources>",
  "numbeoCaveat": "<1-2 sentences reminding the candidate to cross-check levels.fyi and Numbeo directly for up-to-date figures before actually negotiating>"
}`;
}

export function buildSalaryPositioningUserMessage(input: {
	currentSalary: number;
	currentSalaryCurrency: string;
	monthlyRent: number;
	monthlyLivingExpenses: number;
	currentSavingsRate: string;
}): string {
	return `Current gross salary: ${input.currentSalary} ${input.currentSalaryCurrency} per year
Monthly rent: ${input.monthlyRent} ${input.currentSalaryCurrency} (0 if the candidate owns their home or has no rent)
Other monthly living expenses (excluding rent): ${input.monthlyLivingExpenses} ${input.currentSalaryCurrency}
Current annual savings rate: ${input.currentSavingsRate}`;
}

export interface ParsedSalaryPositioning {
	estimatedEquivalentCost: number;
	positionWithinBand: string;
	target: number;
	anchor: number;
	reasoning: string;
	numbeoCaveat: string;
	currency: string;
}

export function parseSalaryPositioningResponse(raw: string, currency: string): ParsedSalaryPositioning | null {
	const parsed = parseModelJson(raw) as Record<string, unknown> | null;
	if (
		parsed &&
		typeof parsed === "object" &&
		typeof parsed.estimatedEquivalentCost === "number" &&
		typeof parsed.target === "number" &&
		typeof parsed.anchor === "number" &&
		typeof parsed.reasoning === "string"
	) {
		return {
			estimatedEquivalentCost: parsed.estimatedEquivalentCost,
			positionWithinBand: typeof parsed.positionWithinBand === "string" ? parsed.positionWithinBand : "mid_band",
			target: parsed.target,
			anchor: parsed.anchor,
			reasoning: parsed.reasoning,
			numbeoCaveat: typeof parsed.numbeoCaveat === "string" ? parsed.numbeoCaveat : "",
			currency,
		};
	}
	return null;
}
