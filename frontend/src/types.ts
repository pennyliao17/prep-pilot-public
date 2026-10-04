export type QuestionType =
	| "product_sense"
	| "analytical_execution"
	| "leadership_principles_behavioral"
	| "strategy_business"
	| "estimation"
	| "system_design"
	| "ai_pm";

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
	{ value: "product_sense", label: "Product Sense" },
	{ value: "analytical_execution", label: "Analytical / Execution" },
	{ value: "leadership_principles_behavioral", label: "Leadership Principles" },
	{ value: "strategy_business", label: "Strategy / Business" },
	{ value: "estimation", label: "Estimation" },
	{ value: "system_design", label: "System Design" },
	{ value: "ai_pm", label: "AI Product Manager" },
];

// Companies this app supports practicing for (2026-08-14, adding Make
// alongside Amazon; 2026-08-26, adding RTB House; 2026-10-02, removing RTB
// House and adding Meta) — see worker/src/index.ts's SUPPORTED_COMPANIES,
// the backend source of truth this list must stay in sync with.
export type Company = "amazon" | "make" | "meta";

export const COMPANIES: { value: Company; label: string }[] = [
	{ value: "amazon", label: "Amazon" },
	{ value: "make", label: "Make" },
	{ value: "meta", label: "Meta" },
];

// Which question types are relevant per company — all three currently
// supported companies share the same 7 PM archetypes. Used by the Practice
// page to only show relevant types for whichever company is selected (see
// App.tsx) — QUESTION_TYPES itself stays the full flat list, since
// Dashboard/TopicReviewPanel just need to label a *past* attempt's type
// regardless of company.
export const QUESTION_TYPES_BY_COMPANY: Record<Company, QuestionType[]> = {
	amazon: ["product_sense", "analytical_execution", "leadership_principles_behavioral", "strategy_business", "estimation", "system_design", "ai_pm"],
	make: ["product_sense", "analytical_execution", "leadership_principles_behavioral", "strategy_business", "estimation", "system_design", "ai_pm"],
	meta: ["product_sense", "analytical_execution", "leadership_principles_behavioral", "strategy_business", "estimation", "system_design", "ai_pm"],
};

export interface Question {
	id: string;
	company: Company;
	type: QuestionType;
	title: string;
	description: string;
	metadata: { difficulty: string; tags: string[] };
}

export interface Feedback {
	id: string;
	scores: Record<string, number>;
	strengths: Record<string, string[]>;
	improvements: Record<string, string[]>;
	overallFeedback: string;
	exampleAnswer: string;
	// Static per-type outline of the ideal answer structure (not AI-generated
	// — see worker/src/prompts.ts's getAnswerFrameworkSteps), shown next to
	// exampleAnswer as a scannable skeleton to practice/memorize, since
	// exampleAnswer itself is deliberately one continuous paragraph.
	answerFramework: string[] | null;
	extra: unknown;
	modelName: string;
	createdAt: string;
}

export interface FeedbackResponse {
	attemptId: string;
	feedback: Feedback;
}

export interface ResumeCoachExtra {
	suggested_lps: string[];
	behavioral_question_types: string[];
	rewritten_star_answer: {
		situation: string;
		task: string;
		actions: string;
		results: string;
		reflection: string;
	};
	// No longer generated (dropped per user feedback); optional only so
	// pre-existing stored results from before the change still type-check.
	resume_rewrite_suggestions?: string[];
	hype_script: string | null;
}

export interface ResumeCoachFeedback {
	id: string;
	extra: ResumeCoachExtra;
	modelName: string;
	createdAt: string;
}

export interface ResumeCoachResponse {
	attemptId: string;
	feedback: ResumeCoachFeedback;
}

export interface AttemptHistoryItem {
	id: string;
	type: string;
	mode: string;
	questionTitle: string | null;
	answerText: string;
	overallScore: number | null;
	scores: Record<string, number> | null;
	strengths: Record<string, string[]> | null;
	improvements: Record<string, string[]> | null;
	overallFeedback: string | null;
	exampleAnswer: string | null;
	// Static per-type outline (see Feedback.answerFramework) — null for
	// resume_coach-mode rows, which show their own STAR+ breakdown instead.
	answerFramework: string[] | null;
	// resume_coach attempts carry a ResumeCoachExtra here; single_question
	// attempts don't use this field (null).
	extra: unknown;
	createdAt: string;
}

export interface AttemptTypeSummary {
	type: string;
	attemptCount: number;
	averageScore: number;
	trend: number | null;
}

export interface AttemptHistoryResponse {
	attempts: AttemptHistoryItem[];
	summary: AttemptTypeSummary[];
}

export interface ResumeCoachProfile {
	resumeText: string | null;
	jobDescription: string | null;
	// Which company's values framework Resume Coach writes toward — always a
	// real value ("amazon" default), distinct from Story.company (which
	// company the *experience* happened at).
	targetCompany: Company;
	updatedAt: string | null;
}

export interface Story {
	id: string;
	title: string;
	content: string;
	company: string | null;
	createdAt: string;
	updatedAt: string;
	// The most recent AI generation for this story, denormalized so it's
	// always readable regardless of the 5-day usage-history expiry — null
	// until "Generate" has been run at least once.
	latestExtra: ResumeCoachExtra | null;
	latestGeneratedAt: string | null;
}

export interface DeletedStory {
	id: string;
	title: string;
	content: string;
	company: string | null;
	deletedAt: string;
}

export interface ResumeCoachHistoryItem {
	id: string;
	type: string;
	storyId: string | null;
	storyTitle: string | null;
	storyCompany: string | null;
	extra: ResumeCoachExtra;
	createdAt: string;
}

export interface ResumeCoachHistoryResponse {
	attempts: ResumeCoachHistoryItem[];
}

export interface QaItem {
	question: string;
	answer: string;
}

// A structured, per-company breakdown of one interview round (HR screen,
// hiring manager, case interview, team fit, final round — or a reference
// section like a fact sheet or salary/negotiation playbook). company is
// free text (not restricted to COMPANIES) so this works for a company
// PrepPilot doesn't otherwise support practicing questions for.
export interface InterviewRound {
	id: string;
	company: string;
	order: number;
	title: string;
	whatItTests: string | null;
	prepFocus: string | null;
	qaItems: QaItem[];
	createdAt: string;
	updatedAt: string;
}

// Mirrors worker/src/prompts.ts's ParsedSalaryPositioning — the demo-only
// Salary Positioning tool's result shape. Amounts are monthly, in `currency`
// (the selected company's band currency).
export interface SalaryPositioningResult {
	estimatedEquivalentCost: number;
	positionWithinBand: string;
	target: number;
	anchor: number;
	reasoning: string;
	numbeoCaveat: string;
	currency: string;
}
