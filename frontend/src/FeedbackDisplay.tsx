import type { Feedback } from "./types";
import AnswerFrameworkOutline from "./AnswerFrameworkOutline";
import { splitIntoParagraphs } from "./textFormatting";

// Title-cases a raw rubric key (e.g. "customer_obsession" -> "Customer
// Obsession") for display — rubric dimension keys are a fixed but
// company-specific set (see docs/rubrics-*.json), so this is a generic
// fallback rather than a lookup table.
function prettifyKey(key: string): string {
	return key
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

interface FeedbackDisplayProps {
	feedback: Feedback;
	// Set when the caller already shows the example answer prominently
	// elsewhere (see TopicReviewPanel.tsx) — avoids rendering it twice.
	hideExampleAnswer?: boolean;
}

export default function FeedbackDisplay({ feedback, hideExampleAnswer }: FeedbackDisplayProps) {
	const subdimensions = Object.keys(feedback.scores);

	return (
		<div className="feedback-display">
			<p className="feedback-overall">{feedback.overallFeedback}</p>

			<div className="feedback-dimensions">
				{subdimensions.map((key) => {
					const score = feedback.scores[key];
					const strengths = feedback.strengths[key] ?? [];
					const improvements = feedback.improvements[key] ?? [];
					return (
						<div className="feedback-dimension" key={key}>
							<div className="feedback-dimension-header">
								<span className="feedback-dimension-name">{prettifyKey(key)}</span>
								<span className="feedback-score">{score} / 5</span>
							</div>
							{strengths.length > 0 && (
								<ul className="feedback-strengths">
									{strengths.map((s, i) => (
										<li key={i}>{s}</li>
									))}
								</ul>
							)}
							{improvements.length > 0 && (
								<ul className="feedback-improvements">
									{improvements.map((s, i) => (
										<li key={i}>{s}</li>
									))}
								</ul>
							)}
						</div>
					);
				})}
			</div>

			{!hideExampleAnswer && (
				<details className="feedback-example">
					<summary>Example answer</summary>
					<AnswerFrameworkOutline steps={feedback.answerFramework} />
					{splitIntoParagraphs(feedback.exampleAnswer).map((paragraph, i) => (
						<p key={i}>{paragraph}</p>
					))}
				</details>
			)}
		</div>
	);
}
