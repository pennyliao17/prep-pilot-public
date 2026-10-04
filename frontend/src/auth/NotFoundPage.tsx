// Deliberately generic: no mention of sign-in, email, or access — a
// non-allowlisted visitor should see something indistinguishable from a
// genuine missing page. See docs/ai-rules.md §1.3.
export default function NotFoundPage() {
	return (
		<div className="not-found-page">
			<h1>404</h1>
			<p>Page not found.</p>
		</div>
	);
}
