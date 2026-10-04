// exampleAnswer is deliberately generated as one continuous paragraph of
// flowing prose (models what a candidate would actually say out loud in an
// interview — see worker/src/prompts.ts's buildFeedbackSystemPrompt), which
// is exactly what makes a long one hard to read as a single wall of text.
// This is a display-only readability transform, not a rewrite: it never
// drops, reorders, or changes any character of the original text — it only
// decides where paragraph breaks go, by grouping sentences.
export function splitIntoParagraphs(text: string, targetParagraphs = 4): string[] {
	if (!text) return [];
	// Break right after a sentence-ending mark: for CJK punctuation (。！？)
	// split immediately (Chinese text runs sentences together with no space
	// after the mark), for Latin punctuation (.!?) only split when it's
	// followed by whitespace (avoids false splits on things like "3.5" or
	// abbreviations) — needed because exampleAnswer may be the original
	// English generation or the live-translated Traditional Chinese version.
	const sentences = text
		.split(/(?<=[。！？])|(?<=[.!?])(?=\s)/)
		.map((s) => s.trim())
		.filter(Boolean);
	if (sentences.length <= 1) return [text];

	const perParagraph = Math.max(1, Math.ceil(sentences.length / targetParagraphs));
	const paragraphs: string[] = [];
	for (let i = 0; i < sentences.length; i += perParagraph) {
		paragraphs.push(sentences.slice(i, i + perParagraph).join(" "));
	}
	return paragraphs;
}
