import { useEffect, useRef, useState } from "react";

interface Option<T extends string> {
	value: T;
	label: string;
}

interface DropdownProps<T extends string> {
	value: T;
	options: Option<T>[];
	onChange: (value: T) => void;
	label: string;
}

// Native <select> can't be restyled cross-browser once its option list is open
// (that popup is OS-rendered), so this is a from-scratch listbox to keep the
// design language consistent when it's open. See docs/design-guidelines.md §6.
export default function Dropdown<T extends string>({ value, options, onChange, label }: DropdownProps<T>) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const selected = options.find((o) => o.value === value);

	useEffect(() => {
		if (!open) return;
		function onClickOutside(e: MouseEvent) {
			if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		document.addEventListener("mousedown", onClickOutside);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("mousedown", onClickOutside);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	return (
		<div className="dropdown" ref={rootRef}>
			<span className="dropdown-label">{label}</span>
			<button
				type="button"
				className="dropdown-trigger"
				aria-haspopup="listbox"
				aria-expanded={open}
				onClick={() => setOpen((o) => !o)}
			>
				{selected?.label}
				<span className="dropdown-chevron" aria-hidden="true">
					▾
				</span>
			</button>
			{open && (
				<ul className="dropdown-list" role="listbox">
					{options.map((o) => (
						<li
							key={o.value}
							role="option"
							aria-selected={o.value === value}
							className={`dropdown-option ${o.value === value ? "dropdown-option--selected" : ""}`}
							onClick={() => {
								onChange(o.value);
								setOpen(false);
							}}
						>
							{o.label}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
