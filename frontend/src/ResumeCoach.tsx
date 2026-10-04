import { useEffect, useRef, useState } from "react";
import {
	postResumeCoach,
	getResumeCoachProfile,
	putResumeCoachProfile,
	getStories,
	createStory,
	updateStory,
	deleteStory,
	getDeletedStories,
	restoreStory,
	purgeStory,
	getResumeCoachHistory,
} from "./api";
import { extractTextFromResumeFile } from "./resumeParsing";
import { COMPANIES, type Story, type DeletedStory, type ResumeCoachHistoryItem, type Company } from "./types";
import Reveal from "./Reveal";
import Dropdown from "./Dropdown";
import ResumeCoachResultDisplay from "./ResumeCoachResultDisplay";
import { LoadingSpinner } from "./LoadingSpinner";

const STORY_DELETE_GRACE_DAYS = 3;

function daysLeft(deletedAt: string): number {
	const expiresAt = new Date(deletedAt).getTime() + STORY_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000;
	return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default function ResumeCoach() {
	// ---------- Resume + JD profile ----------
	const [resumeText, setResumeText] = useState("");
	const [jobDescription, setJobDescription] = useState("");
	// Which company's values framework every generation on this page writes
	// toward — separate from a story's own `company` field (which company the
	// *experience* happened at, used only to tag/filter the Story Bank).
	const [targetCompany, setTargetCompany] = useState<Company>("amazon");
	const [targetCompanySaving, setTargetCompanySaving] = useState(false);
	const [profileSaving, setProfileSaving] = useState(false);
	const [profileSavedAt, setProfileSavedAt] = useState<string | null>(null);
	const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
	const [parsingFile, setParsingFile] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// ---------- Add a new story (also the CRUD list — add/edit/delete live here) ----------
	const [newCompany, setNewCompany] = useState("");
	const [newTitle, setNewTitle] = useState("");
	const [newContent, setNewContent] = useState("");
	const [addingStory, setAddingStory] = useState(false);
	const [stories, setStories] = useState<Story[]>([]);
	const [storiesLoading, setStoriesLoading] = useState(true);
	const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editCompany, setEditCompany] = useState("");
	const [editTitle, setEditTitle] = useState("");
	const [editContent, setEditContent] = useState("");
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [generatingStoryId, setGeneratingStoryId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	// ---------- Recently deleted ----------
	const [deletedStories, setDeletedStories] = useState<DeletedStory[]>([]);
	const [restoringId, setRestoringId] = useState<string | null>(null);
	const [confirmPurgeId, setConfirmPurgeId] = useState<string | null>(null);
	const [purgingId, setPurgingId] = useState<string | null>(null);

	// ---------- Story Bank (renamed from "Usage history" — the generated-result log) ----------
	const [history, setHistory] = useState<ResumeCoachHistoryItem[]>([]);
	const [historyLoading, setHistoryLoading] = useState(true);
	const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
	const [companyFilter, setCompanyFilter] = useState<string | null>(null);

	useEffect(() => {
		getResumeCoachProfile()
			.then((p) => {
				setResumeText(p.resumeText ?? "");
				setJobDescription(p.jobDescription ?? "");
				setTargetCompany(p.targetCompany);
			})
			.catch(() => {
				// Non-fatal: the page still works with an empty profile.
			});
		refreshStories();
		refreshDeletedStories();
		refreshHistory();
	}, []);

	function refreshStories() {
		setStoriesLoading(true);
		getStories()
			.then(setStories)
			.catch(() => setError("Couldn't load your stories."))
			.finally(() => setStoriesLoading(false));
	}

	function refreshDeletedStories() {
		getDeletedStories()
			.then(setDeletedStories)
			.catch(() => {
				// Non-fatal: recently-deleted is a nice-to-have, not blocking.
			});
	}

	function refreshHistory() {
		setHistoryLoading(true);
		getResumeCoachHistory()
			.then((res) => setHistory(res.attempts))
			.catch(() => {
				// Non-fatal: Story Bank history is a nice-to-have, not blocking.
			})
			.finally(() => setHistoryLoading(false));
	}

	async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = ""; // allow re-uploading the same file name later
		if (!file) return;
		setParsingFile(true);
		setError(null);
		try {
			const text = await extractTextFromResumeFile(file);
			setResumeText(text);
			setUploadedFileName(file.name);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't read that file.");
			setUploadedFileName(null);
		} finally {
			setParsingFile(false);
		}
	}

	async function handleSaveProfile() {
		setProfileSaving(true);
		setError(null);
		try {
			const saved = await putResumeCoachProfile({ resumeText, jobDescription });
			setProfileSavedAt(saved.updatedAt);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't save your resume/JD.");
		} finally {
			setProfileSaving(false);
		}
	}

	// Saves immediately on change (unlike resume/JD, which batch into one
	// explicit Save) — picking a company is a discrete choice, not something
	// you'd want to lose by navigating away before hitting Save.
	async function handleTargetCompanyChange(next: Company) {
		setTargetCompany(next);
		setTargetCompanySaving(true);
		setError(null);
		try {
			await putResumeCoachProfile({ targetCompany: next });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't save your target company.");
		} finally {
			setTargetCompanySaving(false);
		}
	}

	// Adding a story immediately generates its LP story too — no separate
	// "now click Generate" step. The story's own row shows the generating
	// state (see generatingStoryId), not the Add button.
	async function handleAddStory() {
		if (!newTitle.trim() || !newContent.trim() || !newCompany.trim()) return;
		setAddingStory(true);
		setError(null);
		try {
			const story = await createStory(newTitle.trim(), newContent.trim(), newCompany.trim());
			setStories((prev) => [story, ...prev]);
			setNewCompany("");
			setNewTitle("");
			setNewContent("");
			handleGenerate(story.id);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't save that story.");
		} finally {
			setAddingStory(false);
		}
	}

	function startEditing(story: Story) {
		setEditingId(story.id);
		setEditCompany(story.company ?? "");
		setEditTitle(story.title);
		setEditContent(story.content);
		setConfirmDeleteId(null);
	}

	// Editing a story re-generates its result immediately afterward — the
	// story text just changed, so the last result no longer reflects it.
	async function handleSaveEdit(id: string) {
		if (!editTitle.trim() || !editContent.trim() || !editCompany.trim()) return;
		try {
			const updated = await updateStory(id, editTitle.trim(), editContent.trim(), editCompany.trim());
			setStories((prev) => prev.map((s) => (s.id === id ? updated : s)));
			setEditingId(null);
			await handleGenerate(id);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't update that story.");
		}
	}

	async function handleConfirmDelete(id: string) {
		setDeletingId(id);
		setError(null);
		try {
			await deleteStory(id);
			setConfirmDeleteId(null);
			if (expandedStoryId === id) setExpandedStoryId(null);
			refreshStories();
			refreshDeletedStories();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't delete that story.");
		} finally {
			setDeletingId(null);
		}
	}

	async function handleRestore(id: string) {
		setRestoringId(id);
		setError(null);
		try {
			await restoreStory(id);
			refreshStories();
			refreshDeletedStories();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't restore that story.");
		} finally {
			setRestoringId(null);
		}
	}

	// Skips the undo grace period and removes the row for good — separate
	// from handleConfirmDelete's soft delete, and irreversible, so it goes
	// through its own inline confirm step first.
	async function handlePurge(id: string) {
		setPurgingId(id);
		setError(null);
		try {
			await purgeStory(id);
			setConfirmPurgeId(null);
			refreshDeletedStories();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't permanently delete that story.");
		} finally {
			setPurgingId(null);
		}
	}

	// No target-LP picker anymore (removed per feedback) — the model always
	// infers the best-fitting LP(s) itself (see buildResumeCoachSystemPrompt's
	// fallback in worker/src/prompts.ts).
	async function handleGenerate(storyId: string) {
		setGeneratingStoryId(storyId);
		setError(null);
		try {
			const res = await postResumeCoach({ type: "leadership_principles_behavioral", storyId });
			setStories((prev) =>
				prev.map((s) => (s.id === storyId ? { ...s, latestExtra: res.feedback.extra, latestGeneratedAt: res.feedback.createdAt } : s))
			);
			setExpandedStoryId(storyId);
			refreshHistory();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setGeneratingStoryId(null);
		}
	}

	// One row per story, not one row per generation: history is already ordered
	// newest-first (see getUserAttemptHistory), so the first entry seen for a
	// given storyId is its latest result — later (older) entries for the same
	// story are dropped instead of listed as separate rows.
	const latestPerStory = new Map<string, ResumeCoachHistoryItem>();
	for (const item of history) {
		if (item.storyTitle === null) continue;
		const key = item.storyId ?? item.id;
		if (!latestPerStory.has(key)) latestPerStory.set(key, item);
	}
	const dedupedHistory = Array.from(latestPerStory.values());

	const companiesInHistory = Array.from(new Set(dedupedHistory.map((item) => item.storyCompany).filter((c): c is string => c !== null))).sort();
	const visibleHistory = dedupedHistory.filter((item) => companyFilter === null || item.storyCompany === companyFilter);

	return (
		<div className="resume-coach">
			<section className="resume-coach-input">
				<h2>Your resume & target job</h2>
				<p className="resume-coach-hint">
					Saved permanently and used, together with your stories and the Amazon Leadership Principles, to
					generate every result on this page.
				</p>

				<div className="resume-coach-target-company-row">
					<Dropdown
						label="Practicing for"
						value={targetCompany}
						onChange={handleTargetCompanyChange}
						options={COMPANIES.map((c) => ({ value: c.value, label: c.label }))}
					/>
					{targetCompanySaving && <LoadingSpinner label="Saving..." />}
				</div>

				<div className="resume-upload-row">
					<input
						ref={fileInputRef}
						type="file"
						accept=".txt,.pdf,text/plain,application/pdf"
						id="resume-upload"
						className="resume-upload-input"
						onChange={handleFileChange}
					/>
					<label htmlFor="resume-upload" className="resume-upload-button">
						{parsingFile ? "Reading file..." : "Upload resume (.txt or .pdf)"}
					</label>
					{uploadedFileName && !parsingFile && <span className="resume-upload-filename">{uploadedFileName}</span>}
				</div>

				<textarea
					placeholder="...or paste your full resume text here."
					value={resumeText}
					onChange={(e) => {
						setResumeText(e.target.value);
						setUploadedFileName(null);
					}}
					rows={6}
				/>

				<label className="resume-coach-field-label" htmlFor="target-jd">
					Target job description
				</label>
				<textarea
					id="target-jd"
					placeholder="Paste the job description for the role you're applying to."
					value={jobDescription}
					onChange={(e) => setJobDescription(e.target.value)}
					rows={6}
				/>

				<button className="resume-coach-submit" onClick={handleSaveProfile} disabled={profileSaving}>
					{profileSaving ? <LoadingSpinner label="Saving..." /> : "Save resume & JD"}
				</button>
				{profileSavedAt && !profileSaving && <span className="resume-coach-saved-hint">Saved.</span>}
			</section>

			<section className="story-bank">
				<h2>Add a new story</h2>
				<p className="resume-coach-hint">
					Add a past experience — we'll automatically map it to the company you're practicing for. Edit or
					delete your stories anytime; editing regenerates the result.
				</p>

				<div className="story-bank-add-form">
					<input
						className="story-card-title-input"
						value={newCompany}
						onChange={(e) => setNewCompany(e.target.value)}
						placeholder="Company (e.g. Amazon, Meta...)"
					/>
					<input
						className="story-card-title-input"
						value={newTitle}
						onChange={(e) => setNewTitle(e.target.value)}
						placeholder="Short title (e.g. 'Fixed the flaky deploy pipeline')"
					/>
					<textarea
						value={newContent}
						onChange={(e) => setNewContent(e.target.value)}
						placeholder="Describe what happened, what you did, and the result."
						rows={5}
					/>
					<button
						className="resume-coach-submit"
						onClick={handleAddStory}
						disabled={!newTitle.trim() || !newContent.trim() || !newCompany.trim() || addingStory}
					>
						{addingStory ? <LoadingSpinner label="Saving..." /> : "Add story"}
					</button>
				</div>

				{storiesLoading ? (
					<LoadingSpinner variant="block" label="Loading your stories..." />
				) : stories.length === 0 ? (
					<p>No stories yet — add one above to get started.</p>
				) : (
					<div className="story-bank-list">
						{stories.map((story) => (
							<div className="story-bank-item" key={story.id}>
								{editingId === story.id ? (
									<div className="story-bank-item-edit">
										<input
											className="story-card-title-input"
											value={editCompany}
											onChange={(e) => setEditCompany(e.target.value)}
											placeholder="Company (e.g. Amazon, Meta...)"
										/>
										<input
											className="story-card-title-input"
											value={editTitle}
											onChange={(e) => setEditTitle(e.target.value)}
											placeholder="Story title"
										/>
										<textarea
											value={editContent}
											onChange={(e) => setEditContent(e.target.value)}
											placeholder="Describe what happened, what you did, and the result."
											rows={5}
										/>
										<div className="story-card-actions">
											<button
												onClick={() => handleSaveEdit(story.id)}
												disabled={!editTitle.trim() || !editContent.trim() || !editCompany.trim()}
											>
												Save & regenerate
											</button>
											<button type="button" className="story-card-cancel" onClick={() => setEditingId(null)}>
												Cancel
											</button>
										</div>
									</div>
								) : confirmDeleteId === story.id ? (
									<div className="story-bank-confirm-delete">
										<p>
											Delete "{story.title}"? It'll be kept for {STORY_DELETE_GRACE_DAYS} days before being
											permanently removed — you can restore it from "Recently deleted" below until then.
										</p>
										<div className="story-card-actions">
											<button
												className="story-card-delete"
												onClick={() => handleConfirmDelete(story.id)}
												disabled={deletingId === story.id}
											>
												{deletingId === story.id ? <LoadingSpinner label="Deleting..." /> : "Confirm delete"}
											</button>
											<button type="button" className="story-card-cancel" onClick={() => setConfirmDeleteId(null)}>
												Cancel
											</button>
										</div>
									</div>
								) : (
									<>
										<button
											type="button"
											className="story-bank-toggle"
											onClick={() => setExpandedStoryId(expandedStoryId === story.id ? null : story.id)}
										>
											<span className="story-bank-toggle-main">
												<span className="story-bank-title">
													{story.company ? `${story.company} — ` : ""}
													{story.title}
												</span>
												{story.latestExtra && (
													<span className="lp-badges lp-badges--compact">
														{story.latestExtra.suggested_lps.map((lp) => (
															<span className="lp-badge" key={lp}>
																{lp}
															</span>
														))}
													</span>
												)}
											</span>
											<span className="story-bank-date">
												{story.latestGeneratedAt ? new Date(story.latestGeneratedAt).toLocaleDateString() : "Not generated yet"}
											</span>
										</button>
										<div className="story-bank-item-actions">
											<button onClick={() => handleGenerate(story.id)} disabled={generatingStoryId === story.id}>
												{generatingStoryId === story.id ? (
													<LoadingSpinner label="Generating..." />
												) : story.latestExtra ? (
													"Regenerate"
												) : (
													"Generate story"
												)}
											</button>
											<button type="button" className="story-card-edit" onClick={() => startEditing(story)}>
												Edit
											</button>
											<button
												type="button"
												className="story-card-delete"
												onClick={() => {
													setConfirmDeleteId(story.id);
													setEditingId(null);
												}}
											>
												Delete
											</button>
										</div>
										{expandedStoryId === story.id && (
											<Reveal className="story-bank-content">
												<p className="story-bank-content-text">{story.content}</p>
											</Reveal>
										)}
									</>
								)}
							</div>
						))}
					</div>
				)}

				{error && <p className="error">{error}</p>}
			</section>

			<section className="resume-coach-history">
				<h2>Story Bank</h2>
				<p className="resume-coach-hint">
					Every generated result, so you can quickly find what you said for a given company. Auto-expires
					and is permanently deleted 5 days after creation.
				</p>

				{companiesInHistory.length > 0 && (
					<div className="chip-filter-row">
						<span className="chip-filter-label">Filter by company:</span>
						<button
							type="button"
							className={`chip-filter-chip ${companyFilter === null ? "chip-filter-chip--selected" : ""}`}
							onClick={() => setCompanyFilter(null)}
						>
							All
						</button>
						{companiesInHistory.map((company) => (
							<button
								type="button"
								key={company}
								className={`chip-filter-chip ${companyFilter === company ? "chip-filter-chip--selected" : ""}`}
								onClick={() => setCompanyFilter(companyFilter === company ? null : company)}
							>
								{company}
							</button>
						))}
					</div>
				)}

				{historyLoading ? (
					<LoadingSpinner variant="block" label="Loading Story Bank..." />
				) : visibleHistory.length === 0 ? (
					<p>No generated results yet — add a story above to get started.</p>
				) : (
					<div className="resume-coach-history-list">
						{visibleHistory.map((item) => (
							<div className="resume-coach-history-item" key={item.id}>
								<button
									type="button"
									className="resume-coach-history-toggle"
									onClick={() => setExpandedHistoryId(expandedHistoryId === item.id ? null : item.id)}
								>
									<span>
										{item.storyCompany ? `${item.storyCompany} — ` : ""}
										{item.storyTitle}
									</span>
									<span className="resume-coach-history-date">{new Date(item.createdAt).toLocaleString()}</span>
								</button>
								{expandedHistoryId === item.id && (
									<Reveal className="resume-coach-result">
										<ResumeCoachResultDisplay extra={item.extra} />
									</Reveal>
								)}
							</div>
						))}
					</div>
				)}
			</section>

			{deletedStories.length > 0 && (
				<section className="recently-deleted">
					<h2>Recently deleted</h2>
					<p className="resume-coach-hint">Restore within {STORY_DELETE_GRACE_DAYS} days, or they're permanently removed.</p>
					<div className="recently-deleted-list">
						{deletedStories.map((story) =>
							confirmPurgeId === story.id ? (
								<div className="recently-deleted-item recently-deleted-item--confirm" key={story.id}>
									<p>
										Permanently delete "{story.title}"? This can't be undone — it won't wait out the{" "}
										{STORY_DELETE_GRACE_DAYS} day grace period.
									</p>
									<div className="story-card-actions">
										<button
											className="story-card-delete"
											onClick={() => handlePurge(story.id)}
											disabled={purgingId === story.id}
										>
											{purgingId === story.id ? <LoadingSpinner label="Deleting..." /> : "Delete permanently"}
										</button>
										<button type="button" className="story-card-cancel" onClick={() => setConfirmPurgeId(null)}>
											Cancel
										</button>
									</div>
								</div>
							) : (
								<div className="recently-deleted-item" key={story.id}>
									<span className="recently-deleted-title">
										{story.company ? `${story.company} — ` : ""}
										{story.title}
									</span>
									<span className="recently-deleted-expiry">{daysLeft(story.deletedAt)} day(s) left</span>
									<button onClick={() => handleRestore(story.id)} disabled={restoringId === story.id}>
										{restoringId === story.id ? <LoadingSpinner label="Restoring..." /> : "Restore"}
									</button>
									<button
										type="button"
										className="story-card-delete"
										onClick={() => setConfirmPurgeId(story.id)}
									>
										Delete permanently
									</button>
								</div>
							)
						)}
					</div>
				</section>
			)}
		</div>
	);
}
