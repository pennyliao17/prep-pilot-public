// A compact, scannable outline of the ideal answer structure for a question
// type — shown next to the AI's exampleAnswer, which is deliberately one
// continuous paragraph of flowing prose (it models what a candidate would
// actually say out loud) and so isn't itself easy to skim or memorize.
//
// steps is static per question type (see worker/src/prompts.ts's
// getAnswerFrameworkSteps) — never AI-generated per request.
export default function AnswerFrameworkOutline({ steps }: { steps: string[] | null }) {
	if (!steps || steps.length === 0) return null;

	return (
		<div className="answer-framework">
			<span className="knowledge-fact-label">How to structure it</span>
			<ul className="answer-framework-list">
				{steps.map((step, i) => (
					<li key={i}>{step}</li>
				))}
			</ul>
		</div>
	);
}
