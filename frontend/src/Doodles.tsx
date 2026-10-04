// Hand-drawn-style decorative SVGs. Purely decorative — never carries information
// on its own (see docs/design-guidelines.md §3), so it's safe to hide from
// screen readers.

export function StarDoodle({ className = "" }: { className?: string }) {
	return (
		<svg className={`doodle ${className}`} viewBox="0 0 40 40" aria-hidden="true">
			<path
				d="M20 3 L23 16 L36 14 L25 22 L32 34 L20 26 L8 34 L15 22 L4 14 L17 16 Z"
				fill="none"
				stroke="var(--ink)"
				strokeWidth="1.6"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

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
