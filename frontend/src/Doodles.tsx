// Hand-drawn-style decorative SVGs. Purely decorative — never carries information
// on its own (see docs/design-guidelines.md §3), so it's safe to hide from
// screen readers.

export function SwirlDoodle({ className = "" }: { className?: string }) {
	return (
		<svg className={`doodle ${className}`} viewBox="0 0 120 20" aria-hidden="true">
			<path
				d="M2 14 Q 18 2, 34 12 T 66 10 T 98 12 T 118 6"
				fill="none"
				stroke="var(--ink)"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

// A friendly notebook with a face and a pencil, for empty states (e.g. a Dashboard
// with no attempts yet). Same ink-outline-plus-green look as the other doodles.
export function NotebookDoodle({ className = "" }: { className?: string }) {
	return (
		<svg className={`doodle ${className}`} viewBox="0 0 180 150" aria-hidden="true">
			<ellipse cx="86" cy="138" rx="46" ry="6" fill="var(--ink)" opacity="0.12" />
			<g transform="rotate(-4 80 70)">
				<rect x="38" y="20" width="84" height="106" rx="10" fill="var(--card-bg)" stroke="var(--ink)" strokeWidth="2.4" />
				<rect x="38" y="20" width="84" height="22" rx="10" fill="var(--green)" stroke="var(--ink)" strokeWidth="2.4" />
				<circle cx="62" cy="31" r="3.4" fill="var(--card-bg)" stroke="var(--ink)" strokeWidth="1.8" />
				<circle cx="80" cy="31" r="3.4" fill="var(--card-bg)" stroke="var(--ink)" strokeWidth="1.8" />
				<circle cx="98" cy="31" r="3.4" fill="var(--card-bg)" stroke="var(--ink)" strokeWidth="1.8" />
				<circle cx="64" cy="72" r="3.6" fill="var(--ink)" />
				<circle cx="96" cy="72" r="3.6" fill="var(--ink)" />
				<circle cx="55" cy="83" r="5.5" fill="var(--green)" opacity="0.75" />
				<circle cx="105" cy="83" r="5.5" fill="var(--green)" opacity="0.75" />
				<path d="M71 82 Q80 92 89 82" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
				<path d="M54 106 H106" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
				<path d="M54 116 H88" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
			</g>
			<g transform="rotate(28 138 92)">
				<rect x="130" y="52" width="16" height="64" rx="3" fill="var(--green)" stroke="var(--ink)" strokeWidth="2.2" />
				<path d="M130 116 L138 134 L146 116 Z" fill="var(--card-bg)" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" />
				<path d="M135 127 L138 134 L141 127 Z" fill="var(--ink)" />
				<rect x="130" y="52" width="16" height="10" rx="3" fill="var(--card-bg)" stroke="var(--ink)" strokeWidth="2.2" />
			</g>
			<path d="M150 24 L153 32 L161 35 L153 38 L150 46 L147 38 L139 35 L147 32 Z" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinejoin="round" />
			<path d="M22 44 L24 50 L30 52 L24 54 L22 60 L20 54 L14 52 L20 50 Z" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
		</svg>
	);
}
