import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LoadingSpinner } from "./LoadingSpinner";

// Shared shell for a "read before the interview" reference page — sidebar
// table of contents with search, scroll-spy syncing the active nav item and
// breadcrumb, a continuous scrollable content flow, and a mobile off-canvas
// drawer. Used by both Interview Rounds (DB-backed, per company) and the
// System Design Guide (static reference content) so this fairly involved
// piece of UI logic exists once.

export interface PrepReaderItem {
	id: string;
	label: string;
	// Plain text used for the search box match — callers pass whatever should
	// be searchable (e.g. question + answer, or a section's raw markdown).
	searchText: string;
	body: ReactNode;
	// Optional short reference-code chip rendered before the label (e.g.
	// "BB01") — opt-in per caller; Interview Rounds leaves this unset so its
	// heading is unchanged.
	badge?: string;
}

export interface PrepReaderSection {
	id: string;
	title: string;
	// Rendered under the section title, above its items (e.g. "what this
	// round tests" / a section intro sentence).
	meta?: ReactNode;
	items: PrepReaderItem[];
}

interface PrepReaderProps {
	sections: PrepReaderSection[];
	loading?: boolean;
	loadingLabel?: string;
	error?: string | null;
	emptyMessage?: string;
	toolbar?: ReactNode;
	searchPlaceholder?: string;
	// "boxed" gives every item its own bordered card — opt-in per caller
	// (System Design Guide uses it; Interview Rounds leaves it unset and
	// keeps its current continuous-flow look).
	itemVariant?: "boxed";
}

// A title like "Q1.2 — Why Europe × Why Prague / 為什麼是歐洲、為什麼是布拉格" or
// "6.1 — 英國 / United Kingdom" carries its English half before the first
// " / " — take that, drop any parenthetical aside, and cap the length so the
// sidebar stays scannable.
function shorten(title: string, maxLen = 46): string {
	const firstSegment = title.split(" / ")[0].split("（")[0].trim();
	return firstSegment.length > maxLen ? `${firstSegment.slice(0, maxLen)}…` : firstSegment;
}

// Item labels are often prefixed with a short reference code (Q1.1, E7, F3,
// 6.4, H1...) — pull that out into its own badge so the nav list reads like
// a real index instead of a wall of prose.
function parseNavLabel(title: string): { code: string | null; label: string } {
	const match = title.match(/^([QE]\d+(?:\.\d+)?|\d+\.\d+|[A-H]\d+)\s*[—–-]?\s*(.*)$/);
	if (match && match[2].trim().length > 0) {
		return { code: match[1], label: shorten(match[2]) };
	}
	return { code: null, label: shorten(title) };
}

export default function PrepReader({
	sections,
	loading,
	loadingLabel = "Loading...",
	error,
	emptyMessage = "Nothing to show yet.",
	toolbar,
	searchPlaceholder = "Search this page...",
	itemVariant,
}: PrepReaderProps) {
	const [search, setSearch] = useState("");
	const [activeId, setActiveId] = useState<string | null>(null);
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

	useEffect(() => {
		setActiveId(null);
	}, [sections]);

	// Scroll-spy: highlight whichever section is currently nearest the top of
	// the viewport and mirror it into the breadcrumb.
	useEffect(() => {
		if (sections.length === 0) return;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) setActiveId(entry.target.id);
				}
			},
			{ rootMargin: "-15% 0px -75% 0px", threshold: 0 }
		);
		sectionRefs.current.forEach((el) => observer.observe(el));
		return () => observer.disconnect();
	}, [sections]);

	function registerSection(id: string, el: HTMLElement | null) {
		if (el) sectionRefs.current.set(id, el);
		else sectionRefs.current.delete(id);
	}

	function scrollToSection(id: string) {
		const el = sectionRefs.current.get(id);
		if (el) {
			el.scrollIntoView({ behavior: "smooth", block: "start" });
			setActiveId(id);
		}
		setSidebarOpen(false);
	}

	const searchTerm = search.trim().toLowerCase();
	const matchesSearch = useMemo(() => {
		if (!searchTerm) return null;
		const matches = new Set<string>();
		for (const section of sections) {
			for (const item of section.items) {
				if (`${item.label} ${item.searchText}`.toLowerCase().includes(searchTerm)) matches.add(item.id);
			}
		}
		return matches;
	}, [sections, searchTerm]);

	const activeSectionTitle = useMemo(() => {
		for (const section of sections) {
			if (section.id === activeId) return section.title;
			if (section.items.some((item) => item.id === activeId)) return section.title;
		}
		return null;
	}, [sections, activeId]);

	const activeItemLabel = useMemo(() => {
		for (const section of sections) {
			const item = section.items.find((it) => it.id === activeId);
			if (item) return shorten(item.label, 60);
		}
		return null;
	}, [sections, activeId]);

	if (loading) return <LoadingSpinner variant="block" label={loadingLabel} />;

	return (
		<div className="prep-reader">
			{toolbar && <div className="ir-toolbar">{toolbar}</div>}

			{error && <p className="error">{error}</p>}

			{!error && sections.length === 0 ? (
				<p>{emptyMessage}</p>
			) : (
				<div className="ir-layout">
					<aside className={`ir-sidebar ${sidebarOpen ? "ir-sidebar--open" : ""}`}>
						<div className="ir-sidebar-header">
							<input
								type="search"
								className="ir-search-input"
								placeholder={searchPlaceholder}
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</div>
						<nav className="ir-nav">
							{sections.map((section) => {
								const groupHasMatch = !matchesSearch || section.items.some((item) => matchesSearch.has(item.id));
								if (!groupHasMatch) return null;
								return (
									<div className="ir-nav-group" key={section.id}>
										<button type="button" className="ir-nav-group-label" onClick={() => scrollToSection(section.id)}>
											{section.title}
										</button>
										{section.items.map((item) => {
											if (matchesSearch && !matchesSearch.has(item.id)) return null;
											const { code, label } = parseNavLabel(item.label);
											return (
												<button
													type="button"
													key={item.id}
													className={`ir-nav-item ${activeId === item.id ? "ir-nav-item--active" : ""}`}
													onClick={() => scrollToSection(item.id)}
												>
													{code && <span className="ir-nav-code">{code}</span>} {label}
												</button>
											);
										})}
									</div>
								);
							})}
							{matchesSearch && matchesSearch.size === 0 && <p className="ir-nav-empty">No matches.</p>}
						</nav>
					</aside>

					{sidebarOpen && <div className="ir-scrim" onClick={() => setSidebarOpen(false)} />}

					<div className="ir-main">
						<div className="ir-topbar">
							<button type="button" className="ir-menu-btn" onClick={() => setSidebarOpen(true)}>
								☰ Contents
							</button>
							<span className="ir-breadcrumb">
								{activeSectionTitle}
								{activeItemLabel ? ` › ${activeItemLabel}` : ""}
							</span>
						</div>

						<div className="ir-content">
							{sections.map((section) => (
								<section id={section.id} className="ir-round-section" key={section.id} ref={(el) => registerSection(section.id, el)}>
									<h2 className="ir-round-title">{section.title}</h2>
									{section.meta && (
										<div className="ir-round-meta">
											<div className="ir-round-meta-text">{section.meta}</div>
										</div>
									)}

									{section.items.map((item) => (
										<section
											id={item.id}
											className={`ir-qa-section ${itemVariant === "boxed" ? "ir-qa-section--boxed" : ""}`}
											key={item.id}
											ref={(el) => registerSection(item.id, el)}
										>
											<h3 className="ir-qa-question">
												{item.badge && <span className="ir-qa-badge">{item.badge}</span>}
												{item.label}
											</h3>
											<div className="ir-qa-answer">{item.body}</div>
										</section>
									))}
								</section>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
