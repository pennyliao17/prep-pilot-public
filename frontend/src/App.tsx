import { useEffect, useState } from "react";
import { getQuestions, postFeedback } from "./api";
import { QUESTION_TYPES, QUESTION_TYPES_BY_COMPANY, COMPANIES, type Question, type QuestionType, type Company, type FeedbackResponse } from "./types";
import { SwirlDoodle } from "./Doodles";
import PageMascot from "./PageMascots";
import Reveal from "./Reveal";
import Dropdown from "./Dropdown";
import FeedbackDisplay from "./FeedbackDisplay";
import ResumeCoach from "./ResumeCoach";
import Dashboard from "./Dashboard";
import CompanyKnowledge from "./CompanyKnowledge";
import InterviewRounds from "./InterviewRounds";
import DemoInterviewGuide from "./DemoInterviewGuide";
import SystemDesignGuide from "./SystemDesignGuide";
import { useAuth } from "./auth/AuthContext";
import LoginGate from "./auth/LoginGate";
import NotFoundPage from "./auth/NotFoundPage";
import { LoadingSpinner } from "./LoadingSpinner";
import "./App.css";

type Page = "practice" | "resume_coach" | "dashboard" | "company_knowledge" | "interview_rounds" | "system_design_guide";

const PRACTICE_COMPANY_STORAGE_KEY = "preppilot-practice-company";

// Mirrors the backend's DEMO_ALLOWED_ROUTES for UX (hiding nav the demo
// session can't use) — the actual access boundary is enforced server-side
// regardless of what this list says. System Design Guide and Company
// Knowledge are static, non-personal reference content, so they're safe to
// show in full. Dashboard is safe too: it's scoped by session email (same
// code path real sessions use) and the demo account now has its own real,
// separate user row, so it only ever shows its own history — empty until
// the demo account is actually used. Interview Rounds stays excluded in its
// real DB-backed form (see InterviewRounds.tsx) — the real data is
// personal/financial — but the demo account gets a separate, sanitized
// stand-in (DemoInterviewGuide) rendered under the same tab below. Resume
// Coach is the one page left out entirely: Story Bank content is real
// personal resume/story data with no safe-to-show generic substitute.
const DEMO_PAGES: Page[] = ["practice", "system_design_guide", "dashboard", "company_knowledge", "interview_rounds"];

function App() {
	const { status, isDemo, signOut } = useAuth();
	const [page, setPage] = useState<Page>("practice");
	const [company, setCompany] = useState<Company>(
		() => (localStorage.getItem(PRACTICE_COMPANY_STORAGE_KEY) as Company | null) ?? "amazon"
	);
	// Derived from the same stored company, not a plain "product_sense"
	// default — all three companies share the same type list today, but this
	// stays company-derived rather than hardcoded in case a future company
	// again needs its own distinct type list (as RTB House once did).
	const [type, setType] = useState<QuestionType>(() => QUESTION_TYPES_BY_COMPANY[company][0]);
	const [question, setQuestion] = useState<Question | null>(null);
	const [questionLoading, setQuestionLoading] = useState(false);
	const [answerText, setAnswerText] = useState("");
	const [feedback, setFeedback] = useState<FeedbackResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// The Worker returns questions in random order and we request two, so
	// "Next question" can always pick one that differs from what's on screen.
	// questionLoading lets the UI tell "still fetching" apart from "fetched but
	// empty" — the latter happens for types with no questions yet (System
	// Design / AI PM), which otherwise showed a permanent loading spinner.
	function loadQuestion(forType: QuestionType, forCompany: Company, currentId: string | null) {
		setError(null);
		setFeedback(null);
		setAnswerText("");
		setQuestion(null);
		setQuestionLoading(true);
		getQuestions(forType, forCompany)
			.then((questions) => {
				const next = questions.find((q) => q.id !== currentId) ?? questions[0] ?? null;
				setQuestion(next);
			})
			.catch((err: Error) => setError(err.message))
			.finally(() => setQuestionLoading(false));
	}

	function handleCompanyChange(next: Company) {
		setCompany(next);
		localStorage.setItem(PRACTICE_COMPANY_STORAGE_KEY, next);
		// All three companies share the same type list today, but this check
		// stays in place for whenever a future company again needs its own
		// distinct type list (as RTB House once did) — switching to a company
		// whose type list doesn't include the currently-selected type would
		// otherwise silently ask for a combination with zero questions.
		const validTypes = QUESTION_TYPES_BY_COMPANY[next];
		if (!validTypes.includes(type)) {
			setType(validTypes[0]);
		}
	}

	useEffect(() => {
		if (status !== "signed_in") return;
		loadQuestion(type, company, null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [type, company, status]);

	// The demo account only ever reaches the pages listed in DEMO_PAGES above
	// — if stale state somehow points anywhere else (e.g. a page chosen
	// before switching accounts), fall back rather than render a tab that
	// isn't in the nav at all.
	useEffect(() => {
		if (isDemo && !DEMO_PAGES.includes(page)) setPage("practice");
	}, [isDemo, page]);

	async function handleSubmit() {
		if (!question) return;
		setLoading(true);
		setError(null);
		try {
			const res = await postFeedback({ questionId: question.id, type, answerText });
			setFeedback(res);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setLoading(false);
		}
	}

	if (status === "loading") {
		return (
			<div className="page">
				<LoadingSpinner variant="block" />
			</div>
		);
	}
	if (status === "forbidden") return <NotFoundPage />;
	if (status !== "signed_in") return <LoginGate />;

	return (
		<div className="page">
			<header className="topbar">
				<h1>
					PM Interview Practice
					<SwirlDoodle className="title-swirl" />
				</h1>
				{isDemo && <span className="demo-badge">Reviewer demo</span>}
				<div className="topbar-actions">
					<button type="button" className="signout-button" onClick={signOut}>
						Sign out
					</button>
				</div>
			</header>

			<div className="page-tabs-bar">
				<PageMascot page={page} busy={loading} />
				<nav className="page-tabs">
					<button
						type="button"
						className={`page-tab ${page === "practice" ? "page-tab--active" : ""}`}
						onClick={() => setPage("practice")}
					>
						Practice
					</button>
					{!isDemo && (
						<button
							type="button"
							className={`page-tab ${page === "resume_coach" ? "page-tab--active" : ""}`}
							onClick={() => setPage("resume_coach")}
						>
							Resume Coach
						</button>
					)}
					<button
						type="button"
						className={`page-tab ${page === "dashboard" ? "page-tab--active" : ""}`}
						onClick={() => setPage("dashboard")}
					>
						Dashboard
					</button>
					<button
						type="button"
						className={`page-tab ${page === "company_knowledge" ? "page-tab--active" : ""}`}
						onClick={() => setPage("company_knowledge")}
					>
						Company Knowledge
					</button>
					<button
						type="button"
						className={`page-tab ${page === "interview_rounds" ? "page-tab--active" : ""}`}
						onClick={() => setPage("interview_rounds")}
					>
						{isDemo ? "Interview Prep Guide" : "Interview Rounds"}
					</button>
					<button
						type="button"
						className={`page-tab ${page === "system_design_guide" ? "page-tab--active" : ""}`}
						onClick={() => setPage("system_design_guide")}
					>
						System Design Guide
					</button>
				</nav>
			</div>

			{page === "resume_coach" ? (
				<ResumeCoach />
			) : page === "dashboard" ? (
				<Dashboard />
			) : page === "company_knowledge" ? (
				<CompanyKnowledge />
			) : page === "interview_rounds" ? (
				isDemo ? <DemoInterviewGuide /> : <InterviewRounds />
			) : page === "system_design_guide" ? (
				<SystemDesignGuide />
			) : (
				<>
					<div className="practice-selectors">
						<Dropdown
							label="Company"
							value={company}
							onChange={handleCompanyChange}
							options={COMPANIES.map((c) => ({ value: c.value, label: c.label }))}
						/>
						<Dropdown
							label="Question type"
							value={type}
							onChange={setType}
							options={QUESTION_TYPES.filter((qt) => QUESTION_TYPES_BY_COMPANY[company].includes(qt.value))}
						/>
					</div>

					{error && <p className="error">{error}</p>}

					<div className="practice-layout">
						<Reveal className="question-panel">
							{question ? (
								<>
									<span className="question-tag">{QUESTION_TYPES.find((qt) => qt.value === type)?.label ?? type}</span>
									<h2>{question.title}</h2>
									<p>{question.description}</p>
									<button
										type="button"
										className="next-question-button"
										onClick={() => loadQuestion(type, company, question.id)}
										disabled={loading || questionLoading}
									>
										Next question
									</button>
								</>
							) : questionLoading ? (
								<LoadingSpinner variant="block" label="Loading question..." />
							) : (
								<p>No questions available for this type yet.</p>
							)}
						</Reveal>

						<section className="answer-panel">
							<textarea
								placeholder="Type your answer here..."
								value={answerText}
								onChange={(e) => setAnswerText(e.target.value)}
								rows={10}
							/>
							<button onClick={handleSubmit} disabled={!question || !answerText || loading}>
								{loading ? <LoadingSpinner label="Scoring..." /> : "Submit for AI Feedback"}
							</button>

							{feedback && (
								<Reveal className="feedback-dump">
									<h3>AI Feedback</h3>
									<FeedbackDisplay feedback={feedback.feedback} />
								</Reveal>
							)}
						</section>
					</div>
				</>
			)}
		</div>
	);
}

export default App;
