interface LoadingSpinnerProps {
	label?: string;
	// "inline" sits next to text inside a button; "block" centers itself in a
	// standalone loading state (e.g. replacing a whole page's content).
	variant?: "inline" | "block";
}

// Bouncing dots rather than a rotating ring: docs/design-guidelines.md bars
// static `rotate` transforms on interactive elements/their direct containers
// (breaks click hit-testing), and this is used inside disabled buttons, so a
// translateY bounce sidesteps that constraint entirely rather than needing to
// carve out an exception.
export function LoadingSpinner({ label, variant = "inline" }: LoadingSpinnerProps) {
	return (
		<span className={`loading-spinner loading-spinner--${variant}`} role="status" aria-live="polite">
			<span className="loading-spinner__dots" aria-hidden="true">
				<span className="loading-spinner__dot" />
				<span className="loading-spinner__dot" />
				<span className="loading-spinner__dot" />
			</span>
			{label ? <span className="loading-spinner__label">{label}</span> : null}
		</span>
	);
}
