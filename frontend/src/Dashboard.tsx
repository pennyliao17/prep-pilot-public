import { useEffect, useState } from "react";
import { getAttemptHistory } from "./api";
import { QUESTION_TYPES, type AttemptHistoryItem, type AttemptHistoryResponse, type QuestionType, type ResumeCoachExtra } from "./types";
import Reveal from "./Reveal";
import FeedbackDisplay from "./FeedbackDisplay";
import ResumeCoachResultDisplay from "./ResumeCoachResultDisplay";
import TopicReviewPanel from "./TopicReviewPanel";
import { LoadingSpinner } from "./LoadingSpinner";

function typeLabel(type: string): string {
	return QUESTION_TYPES.find((t) => t.value === type)?.label ?? type;
}

function isQuestionType(type: string): type is QuestionType {
	return QUESTION_TYPES.some((t) => t.value === type);
}

// A separate label for resume_coach attempts rather than their underlying
// type (always "leadership_principles_behavioral") — showing "Resume Coach"
// avoids implying it's the same activity as an LP practice question.
function activityLabel(item: AttemptHistoryItem): string {
	return item.mode === "resume_coach" ? "Resume Coach" : typeLabel(item.type);
}

function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// "Today" / "Yesterday" for the two most recent days, otherwise a full
// weekday date — this is what lets someone answer "what did I review
// yesterday" at a glance instead of parsing timestamps.
function formatDayHeading(iso: string): string {
	const date = new Date(iso);
	const today = new Date();
	const yesterday = new Date();
	yesterday.setDate(today.getDate() - 1);
	if (date.toDateString() === today.toDateString()) return "Today";
	if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
	return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function dayKey(iso: string): string {
	return new Date(iso).toDateString();
}

interface DayGroup {
	key: string;
	heading: string;
	items: AttemptHistoryItem[];
}

// attempts arrives sorted desc by createdAt from the API, so grouping in a
// single pass preserves that order both across and within day groups.
function groupByDay(attempts: AttemptHistoryItem[]): DayGroup[] {
	const groups: DayGroup[] = [];
	for (const item of attempts) {
		const key = dayKey(item.createdAt);
		const existing = groups.find((g) => g.key === key);
		if (existing) {
			existing.items.push(item);
		} else {
			groups.push({ key, heading: formatDayHeading(item.createdAt), items: [item] });
		}
	}
	return groups;
}

// e.g. "Product Sense ×2, Estimation, Resume Coach" — a one-line summary of
// what was reviewed on a given day, without opening every entry.
function topicsSummary(items: AttemptHistoryItem[]): string {
	const counts = new Map<string, number>();
	for (const item of items) {
		const label = activityLabel(item);
		counts.set(label, (counts.get(label) ?? 0) + 1);
	}
	return Array.from(counts.entries())
		.map(([label, count]) => (count > 1 ? `${label} ×${count}` : label))
		.join(", ");
}

// "+0.4" / "-0.3", or nothing while there isn't enough history yet (see the
// 4-attempt minimum in worker/src/index.ts's buildTypeSummary) — no chart
// library for a single-user dashboard, just a plain delta.
function trendLabel(trend: number | null): string | null {
	if (trend === null) return null;
	if (trend === 0) return "steady";
	return trend > 0 ? `▲ +${trend.toFixed(1)}` : `▼ ${trend.toFixed(1)}`;
}

export default function Dashboard() {
	const [data, setData] = useState<AttemptHistoryResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [reviewType, setReviewType] = useState<QuestionType | null>(null);

	useEffect(() => {
		setLoading(true);
		setError(null);
		getAttemptHistory()
			.then(setData)
			.catch((err: Error) => setError(err.message))
			.finally(() => setLoading(false));
	}, []);

	if (loading) return <LoadingSpinner variant="block" label="Loading your practice history..." />;
	if (error) return <p className="error">{error}</p>;
	if (!data || data.attempts.length === 0) {
		return <p>No practice attempts yet — answer a question in Practice to start building your history here.</p>;
	}

	const dayGroups = groupByDay(data.attempts);

	return (
		<div className="dashboard">
			<section className="dashboard-summary">
				<h2>Average score by question type</h2>
				<div className="summary-grid">
					{data.summary.map((s) => (
						<Reveal className="summary-card" key={s.type}>
							<span className="question-tag">{typeLabel(s.type)}</span>
							<p className="summary-score">{s.averageScore.toFixed(1)} / 5</p>
							<p className="summary-meta">
								{s.attemptCount} {s.attemptCount === 1 ? "attempt" : "attempts"}
								{trendLabel(s.trend) && <span className="summary-trend"> · {trendLabel(s.trend)}</span>}
							</p>
							{isQuestionType(s.type) && (
								<button type="button" className="practice-type-link" onClick={() => setReviewType(s.type as QuestionType)}>
									Review this topic →
								</button>
							)}
						</Reveal>
					))}
				</div>
			</section>

			<section className="dashboard-history">
				<h2>Recent attempts</h2>
				{dayGroups.map((group) => (
					<div className="history-day-group" key={group.key}>
						<div className="history-day-header">
							<h3>{group.heading}</h3>
							<p className="history-day-topics">{topicsSummary(group.items)}</p>
						</div>
						<ul className="history-list">
							{group.items.map((item) => {
								const expanded = expandedId === item.id;
								return (
									<li className="history-item" key={item.id}>
										<button
											type="button"
											className="history-item-summary"
											onClick={() => setExpandedId(expanded ? null : item.id)}
											aria-expanded={expanded}
										>
											<div className="history-item-header">
												<span className="question-tag">{activityLabel(item)}</span>
												<span className="history-score">{item.overallScore !== null ? `${item.overallScore.toFixed(1)} / 5` : "—"}</span>
											</div>
											<p className="history-title">{item.questionTitle ?? "Resume Coach"}</p>
											{!expanded && item.overallFeedback && <p className="history-feedback">{item.overallFeedback}</p>}
											<p className="history-date">{formatTime(item.createdAt)}</p>
										</button>

										{expanded && (
											<div className="history-item-detail">
												<span className="knowledge-fact-label">Your answer</span>
												<p className="history-answer-text">{item.answerText}</p>

												<span className="knowledge-fact-label">AI feedback</span>
												{item.mode === "resume_coach" && item.extra ? (
													<ResumeCoachResultDisplay extra={item.extra as ResumeCoachExtra} />
												) : item.scores ? (
													<FeedbackDisplay
														feedback={{
															id: item.id,
															scores: item.scores,
															strengths: item.strengths ?? {},
															improvements: item.improvements ?? {},
															overallFeedback: item.overallFeedback ?? "",
															exampleAnswer: item.exampleAnswer ?? "",
															answerFramework: item.answerFramework,
															extra: item.extra,
															modelName: "",
															createdAt: item.createdAt,
														}}
													/>
												) : (
													<p className="history-feedback-missing">No feedback was recorded for this attempt.</p>
												)}
											</div>
										)}
									</li>
								);
							})}
						</ul>
					</div>
				))}
			</section>

			{reviewType && (
				<TopicReviewPanel
					type={reviewType}
					attempts={data.attempts.filter((a) => a.type === reviewType && a.mode === "single_question")}
					onClose={() => setReviewType(null)}
				/>
			)}
		</div>
	);
}
