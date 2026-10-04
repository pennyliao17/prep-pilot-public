import { useEffect, useState } from "react";
import { QUESTION_TYPES, type AttemptHistoryItem, type QuestionType } from "./types";
import FeedbackDisplay from "./FeedbackDisplay";
import AnswerFrameworkOutline from "./AnswerFrameworkOutline";
import { splitIntoParagraphs } from "./textFormatting";

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function typeLabel(type: QuestionType): string {
	return QUESTION_TYPES.find((t) => t.value === type)?.label ?? type;
}

interface TopicReviewPanelProps {
	type: QuestionType;
	// Pre-filtered to this type and mode === "single_question", sorted most
	// recent first (same order as the Dashboard's own attempts list).
	attempts: AttemptHistoryItem[];
	onClose: () => void;
}

// A Notion-style "open page" panel: slides in from the left over a dimmed
// backdrop rather than navigating away, so reviewing past questions for a
// topic doesn't lose your place on the Dashboard. Consolidates every past
// attempt for the topic — question, your answer, full AI feedback, and the
// example answer — with the example answer always visible (not tucked
// behind a toggle) since that's the material worth re-reading before an
// interview, per the user's explicit priority.
export default function TopicReviewPanel({ type, attempts, onClose }: TopicReviewPanelProps) {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const raf = requestAnimationFrame(() => setOpen(true));
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", onKeyDown);
		return () => {
			cancelAnimationFrame(raf);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [onClose]);

	return (
		<div className="topic-review-backdrop" onClick={onClose}>
			<div className={`topic-review-panel ${open ? "topic-review-panel--open" : ""}`} onClick={(e) => e.stopPropagation()}>
				<div className="topic-review-header">
					<div>
						<h2>{typeLabel(type)}</h2>
						<p className="topic-review-count">
							{attempts.length} {attempts.length === 1 ? "question" : "questions"} practiced
						</p>
					</div>
					<button type="button" className="topic-review-close" onClick={onClose} aria-label="Close">
						×
					</button>
				</div>

				<div className="topic-review-body">
					{attempts.map((item) => (
						<TopicReviewQuestion key={item.id} item={item} />
					))}
				</div>
			</div>
		</div>
	);
}

function TopicReviewQuestion({ item }: { item: AttemptHistoryItem }) {
	const [showDetail, setShowDetail] = useState(false);

	return (
		<div className="topic-review-question">
			<p className="topic-review-question-title">{item.questionTitle}</p>
			<p className="topic-review-question-meta">
				{formatDate(item.createdAt)}
				{item.overallScore !== null && ` · ${item.overallScore.toFixed(1)} / 5`}
			</p>

			{item.exampleAnswer && (
				<div className="topic-review-example">
					<span className="knowledge-fact-label">Example answer</span>
					<AnswerFrameworkOutline steps={item.answerFramework} />
					{splitIntoParagraphs(item.exampleAnswer).map((paragraph, i) => (
						<p key={i}>{paragraph}</p>
					))}
				</div>
			)}

			<button type="button" className="topic-review-toggle" onClick={() => setShowDetail(!showDetail)}>
				{showDetail ? "Hide your answer & full feedback" : "Show your answer & full feedback"}
			</button>

			{showDetail && (
				<div className="topic-review-detail">
					<span className="knowledge-fact-label">Your answer</span>
					<p className="history-answer-text">{item.answerText}</p>

					{item.scores && (
						<>
							<span className="knowledge-fact-label">AI feedback</span>
							{/* hideExampleAnswer: already shown prominently above, not duplicated here */}
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
								hideExampleAnswer
							/>
						</>
					)}
				</div>
			)}
		</div>
	);
}
