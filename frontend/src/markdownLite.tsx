import type { ReactNode } from "react";

// A tiny, purpose-built markdown renderer for Interview Rounds Q&A content —
// not a general CommonMark implementation, just the handful of constructs
// this data actually uses (bold/italic/code, blockquotes, bullet/numbered
// lists, tables, fenced code blocks, hr, "### " sub-labels). Kept
// dependency-free rather than pulling in a markdown library for one reading
// view.

function renderInline(text: string, keyPrefix: string): ReactNode[] {
	const parts: ReactNode[] = [];
	let remaining = text;
	let key = 0;
	// Bold must be tried before italic — at a "**" position both alternatives
	// could start matching, and ordering them this way makes the regex engine
	// prefer the (correct) bold interpretation instead of reading it as two
	// adjacent empty italics.
	const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/;
	while (remaining.length > 0) {
		const match = pattern.exec(remaining);
		if (!match || match.index === undefined) {
			parts.push(remaining);
			break;
		}
		if (match.index > 0) parts.push(remaining.slice(0, match.index));
		if (match[2] !== undefined) {
			parts.push(<strong key={`${keyPrefix}-${key++}`}>{match[2]}</strong>);
		} else if (match[3] !== undefined) {
			parts.push(<em key={`${keyPrefix}-${key++}`}>{match[3]}</em>);
		} else if (match[4] !== undefined) {
			parts.push(<code key={`${keyPrefix}-${key++}`}>{match[4]}</code>);
		}
		remaining = remaining.slice(match.index + match[0].length);
	}
	return parts;
}

// Walks a run of list-item lines starting at `start`, folding a "→ "
// follow-up line (optionally separated by one blank line) into the
// preceding item instead of ending the list — without this, a list whose
// items each carry a "→ note underneath" callout gets split into a
// separate single-item <ol>/<ul> per entry, and an <ol> restarts its
// numbering at 1 every time. Each entry's lines (item text + any "→" notes)
// are returned separately so the caller can render the note visually
// distinct from the main item text.
function collectListItems(lines: string[], start: number, itemPattern: RegExp): { entries: string[][]; nextIndex: number } {
	const entries: string[][] = [];
	let i = start;
	while (i < lines.length) {
		const t = lines[i].trim();
		if (itemPattern.test(t)) {
			entries.push([t.replace(itemPattern, "")]);
			i++;
		} else if (t.startsWith("→") && entries.length > 0) {
			entries[entries.length - 1].push(t);
			i++;
		} else if (t === "") {
			const next = (lines[i + 1] ?? "").trim();
			if (itemPattern.test(next) || (next.startsWith("→") && entries.length > 0)) {
				i++;
			} else {
				break;
			}
		} else {
			break;
		}
	}
	return { entries, nextIndex: i };
}

function renderListItemLines(itemLines: string[], keyPrefix: string): ReactNode {
	const [main, ...notes] = itemLines;
	return (
		<>
			{renderInline(main, keyPrefix)}
			{notes.map((note, ni) => (
				<div className="md-list-note" key={`${keyPrefix}-note-${ni}`}>
					{renderInline(note, `${keyPrefix}-note-${ni}`)}
				</div>
			))}
		</>
	);
}

function splitTableRow(line: string): string[] {
	return line
		.trim()
		.replace(/^\|/, "")
		.replace(/\|$/, "")
		.split("|")
		.map((cell) => cell.trim());
}

export function renderMarkdownLite(text: string): ReactNode {
	const lines = text.split("\n");
	const blocks: ReactNode[] = [];
	let i = 0;
	let blockKey = 0;

	while (i < lines.length) {
		const line = lines[i];
		const trimmed = line.trim();

		if (trimmed === "") {
			i++;
			continue;
		}

		// Fenced code block.
		if (trimmed.startsWith("```")) {
			const codeLines: string[] = [];
			i++;
			while (i < lines.length && !lines[i].trim().startsWith("```")) {
				codeLines.push(lines[i]);
				i++;
			}
			i++;
			blocks.push(
				<pre key={blockKey++}>
					<code>{codeLines.join("\n")}</code>
				</pre>
			);
			continue;
		}

		// Horizontal rule.
		if (/^-{3,}$/.test(trimmed)) {
			blocks.push(<hr key={blockKey++} />);
			i++;
			continue;
		}

		// "### " sub-label within an answer — rendered as a small bold line,
		// not a real heading (these are emphasis within one Q&A block, not
		// document structure).
		const headingMatch = trimmed.match(/^#{1,4}\s+(.*)$/);
		if (headingMatch) {
			blocks.push(
				<p className="md-sublabel" key={blockKey++}>
					{renderInline(headingMatch[1], `h${blockKey}`)}
				</p>
			);
			i++;
			continue;
		}

		// Table: a "| ... |" row followed by a "|---|---|" separator row.
		if (trimmed.startsWith("|") && /^\|[\s:|-]+\|?$/.test((lines[i + 1] ?? "").trim())) {
			const headerCells = splitTableRow(line);
			i += 2;
			const rows: string[][] = [];
			while (i < lines.length && lines[i].trim().startsWith("|")) {
				rows.push(splitTableRow(lines[i]));
				i++;
			}
			blocks.push(
				<div className="md-table-wrap" key={blockKey++}>
					<table>
						<thead>
							<tr>
								{headerCells.map((c, ci) => (
									<th key={ci}>{renderInline(c, `th${blockKey}-${ci}`)}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((r, ri) => (
								<tr key={ri}>
									{r.map((c, ci) => (
										<td key={ci}>{renderInline(c, `td${blockKey}-${ri}-${ci}`)}</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			);
			continue;
		}

		// Blockquote: consecutive "> " lines, with bare ">" lines acting as
		// paragraph breaks within the same quote.
		if (trimmed.startsWith(">")) {
			const quoteLines: string[] = [];
			while (i < lines.length) {
				const t = lines[i].trim();
				if (t.startsWith(">")) {
					quoteLines.push(t.replace(/^>\s?/, ""));
					i++;
				} else {
					break;
				}
			}
			const paras = quoteLines
				.join("\n")
				.split(/\n\s*\n/)
				.map((p) => p.replace(/\n/g, " ").trim())
				.filter((p) => p.length > 0);
			blocks.push(
				<blockquote key={blockKey++}>
					{paras.map((p, pi) => (
						<p key={pi}>{renderInline(p, `bq${blockKey}-${pi}`)}</p>
					))}
				</blockquote>
			);
			continue;
		}

		// Unordered list. A "→ " line right after an item (with or without a
		// blank line between) is a continuation/note attached to that same
		// item, not a new block — source content uses this a lot (a list item
		// plus a follow-up callout underneath it).
		if (/^[-*]\s+/.test(trimmed)) {
			const items = collectListItems(lines, i, /^[-*]\s+/);
			i = items.nextIndex;
			blocks.push(
				<ul key={blockKey++}>
					{items.entries.map((it, ii) => (
						<li key={ii}>{renderListItemLines(it, `li${blockKey}-${ii}`)}</li>
					))}
				</ul>
			);
			continue;
		}

		// Ordered list — same continuation handling as above.
		if (/^\d+\.\s+/.test(trimmed)) {
			const items = collectListItems(lines, i, /^\d+\.\s+/);
			i = items.nextIndex;
			blocks.push(
				<ol key={blockKey++}>
					{items.entries.map((it, ii) => (
						<li key={ii}>{renderListItemLines(it, `oli${blockKey}-${ii}`)}</li>
					))}
				</ol>
			);
			continue;
		}

		// Default: a paragraph, consuming lines until a blank line or the
		// start of another block type.
		const paraLines: string[] = [];
		while (
			i < lines.length &&
			lines[i].trim() !== "" &&
			!/^[-*]\s+/.test(lines[i].trim()) &&
			!/^\d+\.\s+/.test(lines[i].trim()) &&
			!lines[i].trim().startsWith(">") &&
			!lines[i].trim().startsWith("|") &&
			!lines[i].trim().startsWith("#") &&
			!lines[i].trim().startsWith("```") &&
			!/^-{3,}$/.test(lines[i].trim())
		) {
			paraLines.push(lines[i].trim());
			i++;
		}
		if (paraLines.length > 0) {
			blocks.push(<p key={blockKey++}>{renderInline(paraLines.join(" "), `p${blockKey}`)}</p>);
		} else {
			i++; // safety net against an unhandled line type causing an infinite loop
		}
	}

	return <>{blocks}</>;
}
