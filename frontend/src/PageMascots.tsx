// One small animated character per page, standing on the tab strip's baseline. Each is
// decorative (aria-hidden) and drawn in the same ink-outline-plus-green style as the other
// doodles. `busy` only affects the Practice lightbulb (it bounces while an answer is scored).

export type MascotPage = "practice" | "resume_coach" | "dashboard" | "company_knowledge" | "interview_rounds" | "system_design_guide";

const INK = "var(--ink)";
const GREEN = "var(--green)";
const WHITE = "var(--card-bg)";

function Face({ x, y, gap = 12 }: { x: number; y: number; gap?: number }) {
	return (
		<g className="mascot-face">
			<g className="mascot-eyes">
				<circle cx={x - gap / 2} cy={y} r="1.9" fill={INK} />
				<circle cx={x + gap / 2} cy={y} r="1.9" fill={INK} />
			</g>
			<path d={`M${x - 4} ${y + 5} Q${x} ${y + 10} ${x + 4} ${y + 5}`} fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
		</g>
	);
}

function Bulb() {
	return (
		<>
			<path className="mascot-rays" d="M32 2 V7 M10 12 L14 16 M54 12 L50 16 M4 32 H9 M55 32 H60" stroke={INK} strokeWidth="2" strokeLinecap="round" />
			<path
				d="M32 8 C19 8 12 18 12 28 C12 36 16 41 20 46 C22 48 23 50 23 53 H41 C41 50 42 48 44 46 C48 41 52 36 52 28 C52 18 45 8 32 8 Z"
				fill={GREEN}
				stroke={INK}
				strokeWidth="2.2"
				strokeLinejoin="round"
			/>
			<rect x="24" y="53" width="16" height="5" rx="2.5" fill={WHITE} stroke={INK} strokeWidth="2" />
			<rect x="26" y="58" width="12" height="4" rx="2" fill={WHITE} stroke={INK} strokeWidth="2" />
			<Face x={32} y={29} gap={14} />
		</>
	);
}

function Resume() {
	return (
		<>
			<path d="M14 6 H40 L50 16 V58 H14 Z" fill={WHITE} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
			<path d="M40 6 V16 H50" fill={GREEN} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
			<Face x={30} y={26} gap={10} />
			<path d="M21 40 H43 M21 46 H36" stroke={INK} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
			<path className="mascot-check" d="M37 51 L41 55 L48 46" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
		</>
	);
}

function Chart() {
	return (
		<>
			<path d="M6 58 H58" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
			<rect className="mascot-bar mascot-bar--1" x="9" y="38" width="13" height="20" rx="2" fill={WHITE} stroke={INK} strokeWidth="2.2" />
			<rect className="mascot-bar mascot-bar--2" x="26" y="10" width="14" height="48" rx="2" fill={GREEN} stroke={INK} strokeWidth="2.2" />
			<rect className="mascot-bar mascot-bar--3" x="44" y="28" width="13" height="30" rx="2" fill={WHITE} stroke={INK} strokeWidth="2.2" />
			<Face x={33} y={24} gap={6} />
		</>
	);
}

function Building() {
	return (
		<>
			<path d="M32 4 V14" stroke={INK} strokeWidth="2" strokeLinecap="round" />
			<path className="mascot-flag" d="M32 4 L44 8 L32 12 Z" fill={GREEN} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
			<rect x="16" y="14" width="32" height="44" rx="3" fill={WHITE} stroke={INK} strokeWidth="2.2" />
			{[0, 1, 2].map((row) =>
				[0, 1].map((col) => (
					<rect
						key={`${row}-${col}`}
						className={`mascot-window mascot-window--${(row + col) % 3}`}
						x={22 + col * 14}
						y={20 + row * 10}
						width="8"
						height="6"
						rx="1"
						fill={GREEN}
						stroke={INK}
						strokeWidth="1.6"
					/>
				))
			)}
			<path d="M26 58 V50 H38 V58" fill={GREEN} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
		</>
	);
}

function Chat() {
	return (
		<>
			<path d="M6 10 H38 Q42 10 42 14 V32 Q42 36 38 36 H20 L12 44 V36 H10 Q6 36 6 32 V14 Q6 10 10 10 Z" fill={GREEN} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
			<circle className="mascot-dot mascot-dot--1" cx="16" cy="23" r="2.6" fill={INK} />
			<circle className="mascot-dot mascot-dot--2" cx="24" cy="23" r="2.6" fill={INK} />
			<circle className="mascot-dot mascot-dot--3" cx="32" cy="23" r="2.6" fill={INK} />
			<path d="M26 38 H54 Q58 38 58 42 V54 Q58 58 54 58 H52 V64 L44 58 H26 Q22 58 22 54 V42 Q22 38 26 38 Z" fill={WHITE} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
			<Face x={40} y={47} gap={9} />
		</>
	);
}

function Nodes() {
	return (
		<>
			<path d="M32 22 L16 42 M32 22 L48 42 M24 52 H40" stroke={INK} strokeWidth="2" strokeLinecap="round" />
			<rect className="mascot-node mascot-node--1" x="20" y="4" width="24" height="18" rx="4" fill={GREEN} stroke={INK} strokeWidth="2.2" />
			<Face x={32} y={11} gap={8} />
			<rect className="mascot-node mascot-node--2" x="4" y="42" width="20" height="14" rx="4" fill={WHITE} stroke={INK} strokeWidth="2.2" />
			<rect className="mascot-node mascot-node--3" x="40" y="42" width="20" height="14" rx="4" fill={WHITE} stroke={INK} strokeWidth="2.2" />
		</>
	);
}

const MASCOTS: Record<MascotPage, () => React.ReactElement> = {
	practice: Bulb,
	resume_coach: Resume,
	dashboard: Chart,
	company_knowledge: Building,
	interview_rounds: Chat,
	system_design_guide: Nodes,
};

export default function PageMascot({ page, busy = false }: { page: MascotPage; busy?: boolean }) {
	const Art = MASCOTS[page];
	return (
		<svg
			key={page}
			className={`page-mascot page-mascot--${page} ${busy ? "page-mascot--busy" : ""}`}
			viewBox="0 0 64 64"
			aria-hidden="true"
		>
			<Art />
		</svg>
	);
}
