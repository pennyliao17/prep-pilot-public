import { describe, it, expect } from "vitest";
import {
	buildSalaryPositioningSystemPrompt,
	parseFeedbackResponse,
	parseResumeCoachResponse,
	parseSalaryPositioningResponse,
	SALARY_BANDS,
	SALARY_REGIONS,
} from "../src/prompts";

describe("parseFeedbackResponse", () => {
	const valid = {
		scores: { clarity_and_structure: 3 },
		strengths: { clarity_and_structure: ["Clear opening."] },
		improvements: { clarity_and_structure: ["Add a metric."] },
		overallFeedback: "Solid start.",
		exampleAnswer: "First, I'd ask about scope. Next, I'd confirm the goal.",
	};

	it("parses clean JSON", () => {
		const parsed = parseFeedbackResponse(JSON.stringify(valid));
		expect(parsed?.overallFeedback).toBe("Solid start.");
	});

	it("strips markdown fences", () => {
		const parsed = parseFeedbackResponse("```json\n" + JSON.stringify(valid) + "\n```");
		expect(parsed?.scores.clarity_and_structure).toBe(3);
	});

	// The regression this guards: the feedback model (now that exampleAnswer is a
	// long multi-step answer) sometimes emits literal newlines inside a string
	// value, which is invalid JSON. The parser must recover rather than 502.
	it("recovers from literal newlines inside a string value", () => {
		const withRawNewlines =
			'{"scores":{"clarity_and_structure":3},"overallFeedback":"Good.",' +
			'"exampleAnswer":"First, I would ask about scope.\nNext, I would confirm the goal.\nThen I would segment users."}';
		// Sanity check: this really is invalid JSON as-is.
		expect(() => JSON.parse(withRawNewlines)).toThrow();

		const parsed = parseFeedbackResponse(withRawNewlines);
		expect(parsed).not.toBeNull();
		expect(parsed?.exampleAnswer).toContain("Next, I would confirm the goal.");
	});

	// The dominant real failure: the 8B model finishes the last string value on a
	// long answer but omits the closing "}". Output is well under the token limit,
	// so it's not truncation — just a forgotten brace the repair must close.
	it("recovers when the model omits the final closing brace", () => {
		const missingBrace =
			'{"scores":{"clarity_and_structure":2},"overallFeedback":"Too shallow.",' +
			'"exampleAnswer":"First, I would clarify scope. Then I would confirm the goal and propose a solution."';
		expect(() => JSON.parse(missingBrace)).toThrow();

		const parsed = parseFeedbackResponse(missingBrace);
		expect(parsed).not.toBeNull();
		expect(parsed?.scores.clarity_and_structure).toBe(2);
		expect(parsed?.exampleAnswer).toContain("confirm the goal");
	});

	// Combined worst case: raw newline inside the string AND a missing closing brace.
	it("recovers from both a raw newline and a missing closing brace", () => {
		const both =
			'{"scores":{"x":3},"overallFeedback":"ok",' +
			'"exampleAnswer":"First, I would ask.\nThen I would answer."';
		expect(() => JSON.parse(both)).toThrow();
		const parsed = parseFeedbackResponse(both);
		expect(parsed).not.toBeNull();
		expect(parsed?.exampleAnswer).toContain("Then I would answer.");
	});

	it("returns null for a missing required field", () => {
		const parsed = parseFeedbackResponse('{"scores":{},"overallFeedback":"x"}');
		expect(parsed).toBeNull();
	});

	it("returns null for total garbage", () => {
		expect(parseFeedbackResponse("not json at all")).toBeNull();
	});
});

describe("parseResumeCoachResponse", () => {
	it("recovers from literal newlines inside the STAR fields", () => {
		const withRawNewlines =
			'{"suggested_lps":["Ownership"],"behavioral_question_types":["Tell me about ownership."],' +
			'"rewritten_star_answer":{"situation":"Line one.\nLine two.","task":"t","actions":"a","results":"r","reflection":"x"},' +
			'"resume_rewrite_suggestions":["Original: x","Suggested: y"]}';
		expect(() => JSON.parse(withRawNewlines)).toThrow();

		const parsed = parseResumeCoachResponse(withRawNewlines);
		expect(parsed).not.toBeNull();
		expect(parsed?.suggestedLps).toEqual(["Ownership"]);
		expect(parsed?.rewrittenStarAnswer.situation).toContain("Line two.");
	});
});

describe("salary positioning bands", () => {
	const companies = ["amazon", "make", "meta"];

	it("has a sane Europe and US band for every supported company, embedded in that prompt", () => {
		for (const company of companies) {
			for (const region of SALARY_REGIONS) {
				const band = SALARY_BANDS[company][region];
				expect(band.floor).toBeGreaterThan(0);
				expect(band.ceiling).toBeGreaterThan(band.floor);
				const prompt = buildSalaryPositioningSystemPrompt(company, region) as string;
				expect(prompt).toContain(band.cityLabel);
				expect(prompt).toContain(`${band.currency} ${band.floor.toLocaleString()}`);
				expect(prompt).toContain("NOT a real offer");
			}
		}
	});

	it("uses a different band for every company and region", () => {
		const prompts = companies.flatMap((c) => SALARY_REGIONS.map((r) => buildSalaryPositioningSystemPrompt(c, r)));
		expect(new Set(prompts).size).toBe(6);
		expect(SALARY_BANDS.make.europe.currency).toBe("CZK");
		expect(SALARY_BANDS.meta.us.currency).toBe("USD");
		expect(SALARY_BANDS.meta.europe.floor).toBeGreaterThan(SALARY_BANDS.amazon.europe.ceiling);
	});

	it("returns null for an unknown company", () => {
		expect(buildSalaryPositioningSystemPrompt("acme", "us")).toBeNull();
	});

	it("parses the model response and stamps the band currency", () => {
		const raw = JSON.stringify({
			estimatedEquivalentCost: 9000,
			positionWithinBand: "upper_band",
			target: 8500,
			anchor: 9000,
			reasoning: "An estimate.",
			numbeoCaveat: "Check Numbeo.",
		});
		expect(parseSalaryPositioningResponse(raw, "GBP")).toMatchObject({ target: 8500, anchor: 9000, currency: "GBP" });
		expect(parseSalaryPositioningResponse("not json", "GBP")).toBeNull();
	});
});
