import type { TextItem } from "pdfjs-dist/types/src/display/api";

// All parsing happens in the browser (no upload to any server) so this stays
// free and keeps resume content off the network until the user hits submit.
// pdfjs-dist is dynamically imported so its ~1MB (worker + lib) is only ever
// fetched by someone who actually uploads a PDF, not on every page load.
async function extractPdfText(file: File): Promise<string> {
	const [pdfjsLib, { default: pdfWorkerUrl }] = await Promise.all([
		import("pdfjs-dist"),
		import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
	]);
	pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

	const buffer = await file.arrayBuffer();
	const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
	const pageTexts: string[] = [];
	for (let i = 1; i <= pdf.numPages; i++) {
		const page = await pdf.getPage(i);
		const content = await page.getTextContent();
		const text = content.items.map((item) => ("str" in item ? (item as TextItem).str : "")).join(" ");
		pageTexts.push(text);
	}
	return pageTexts.join("\n\n").trim();
}

export async function extractTextFromResumeFile(file: File): Promise<string> {
	const name = file.name.toLowerCase();
	if (file.type === "application/pdf" || name.endsWith(".pdf")) {
		const text = await extractPdfText(file);
		if (!text) throw new Error("Couldn't find any text in that PDF — it may be a scanned image without a text layer.");
		return text;
	}
	if (file.type === "text/plain" || name.endsWith(".txt")) {
		const text = (await file.text()).trim();
		if (!text) throw new Error("That file is empty.");
		return text;
	}
	throw new Error("Unsupported file type. Please upload a .txt or .pdf resume.");
}
