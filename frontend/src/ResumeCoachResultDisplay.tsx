import type { ResumeCoachExtra } from "./types";

// Extracted from ResumeCoach.tsx so the exact same result rendering can be
// reused in Dashboard's expanded attempt view — resume_coach attempts don't
// have rubric scores, so they need this instead of FeedbackDisplay.
export default function ResumeCoachResultDisplay({ extra }: { extra: ResumeCoachExtra }) {
	const star = extra.rewritten_star_answer;

	return (
		<div className="resume-coach-result-display">
			<h3>Suggested Principles / Values</h3>
			<div className="lp-badges">
				{extra.suggested_lps.map((lp) => (
					<span className="lp-badge" key={lp}>
						{lp}
					</span>
				))}
			</div>

			<h3>Behavioral Questions This Story Answers</h3>
			<ul className="resume-coach-list">
				{extra.behavioral_question_types.map((q, i) => (
					<li key={i}>{q}</li>
				))}
			</ul>

			<h3>Rewritten STAR+ Answer</h3>
			<div className="star-answer">
				<p>
					<strong>Situation:</strong> {star?.situation}
				</p>
				<p>
					<strong>Task:</strong> {star?.task}
				</p>
				<p>
					<strong>Action:</strong> {star?.actions}
				</p>
				<p>
					<strong>Result:</strong> {star?.results}
				</p>
				<p>
					<strong>Reflection:</strong> {star?.reflection}
				</p>
			</div>

			{extra.hype_script && (
				<>
					<h3>Your 60-Second Hype Script</h3>
					<p className="hype-script">{extra.hype_script}</p>
				</>
			)}
		</div>
	);
}
