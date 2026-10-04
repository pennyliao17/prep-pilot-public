import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { postGoogleSignIn, postEmailSignInStart, postEmailSignInVerify, postDemoSignIn } from "../api";
import { LoadingSpinner } from "../LoadingSpinner";

interface GoogleCredentialResponse {
	credential: string;
}

declare global {
	interface Window {
		google?: {
			accounts: {
				id: {
					initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
					renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
				};
			};
		};
	}
}

// Injected once and cached — a fresh script tag per LoginGate mount (e.g.
// under React StrictMode's double-invoke in dev) would otherwise double-load
// Google's client script.
let gisScriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
	if (!gisScriptPromise) {
		gisScriptPromise = new Promise((resolve, reject) => {
			const script = document.createElement("script");
			// ?hl=en forces English regardless of the browser's own locale —
			// design-guidelines.md: UI is English-only site-wide. (The `locale`
			// field on initialize()/renderButton() is not honored; the script
			// URL's hl param is the documented way to set this.)
			script.src = "https://accounts.google.com/gsi/client?hl=en";
			script.async = true;
			script.defer = true;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error("Failed to load Google Sign-In."));
			document.head.appendChild(script);
		});
	}
	return gisScriptPromise;
}

type EmailStep = "email" | "code";

export default function LoginGate() {
	const { signIn, forbidden } = useAuth();
	const buttonRef = useRef<HTMLDivElement>(null);
	const [error, setError] = useState<string | null>(null);

	const [emailStep, setEmailStep] = useState<EmailStep>("email");
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [loading, setLoading] = useState(false);

	const [showDemoLogin, setShowDemoLogin] = useState(false);
	const [demoUsername, setDemoUsername] = useState("");
	const [demoPassword, setDemoPassword] = useState("");
	const [demoLoading, setDemoLoading] = useState(false);
	const [demoError, setDemoError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function handleCredentialResponse(response: GoogleCredentialResponse) {
			setError(null);
			try {
				const result = await postGoogleSignIn(response.credential);
				if ("forbidden" in result) {
					forbidden();
					return;
				}
				signIn(result.token, result.email);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Sign-in failed.");
			}
		}

		loadGoogleScript()
			.then(() => {
				if (cancelled || !window.google || !buttonRef.current) return;
				window.google.accounts.id.initialize({
					client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
					callback: handleCredentialResponse,
				});
				window.google.accounts.id.renderButton(buttonRef.current, {
					theme: "outline",
					size: "large",
					text: "signin_with",
				});
			})
			.catch((err) => setError(err instanceof Error ? err.message : "Failed to load Google Sign-In."));

		return () => {
			cancelled = true;
		};
	}, [signIn, forbidden]);

	async function handleEmailContinue() {
		setError(null);
		setLoading(true);
		try {
			await postEmailSignInStart(email);
			setEmailStep("code");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't send the verification email.");
		} finally {
			setLoading(false);
		}
	}

	async function handleCodeContinue() {
		setError(null);
		setLoading(true);
		try {
			const result = await postEmailSignInVerify(email, code);
			if ("forbidden" in result) {
				forbidden();
				return;
			}
			signIn(result.token, result.email);
		} catch (err) {
			setError(err instanceof Error ? err.message : "That code is invalid or has expired.");
		} finally {
			setLoading(false);
		}
	}

	function handleUseDifferentEmail() {
		setError(null);
		setCode("");
		setEmailStep("email");
	}

	async function handleDemoSignIn() {
		setDemoError(null);
		setDemoLoading(true);
		try {
			const result = await postDemoSignIn(demoUsername, demoPassword);
			signIn(result.token, result.email, "demo");
		} catch (err) {
			setDemoError(err instanceof Error ? err.message : "Sign-in failed.");
		} finally {
			setDemoLoading(false);
		}
	}

	return (
		<div className="login-gate">
			<div className="login-card">
				<h1>Sign in to continue</h1>
				<div ref={buttonRef} className="login-gate-button" />

				<div className="login-divider">
					<span>OR</span>
				</div>

				{emailStep === "email" ? (
					<>
						<label className="login-field-label" htmlFor="login-email">
							Email
						</label>
						<input
							id="login-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@example.com"
						/>
						<button onClick={handleEmailContinue} disabled={!email.trim() || loading}>
							{loading ? <LoadingSpinner label="Sending..." /> : "Continue"}
						</button>
					</>
				) : (
					<>
						<p className="login-code-hint">We sent a verification code to {email}.</p>
						<label className="login-field-label" htmlFor="login-code">
							Verification code
						</label>
						<input
							id="login-code"
							type="text"
							inputMode="numeric"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							placeholder="123456"
						/>
						<button onClick={handleCodeContinue} disabled={!code.trim() || loading}>
							{loading ? <LoadingSpinner label="Verifying..." /> : "Continue"}
						</button>
						<button type="button" className="login-link-button" onClick={handleUseDifferentEmail}>
							Use a different email
						</button>
					</>
				)}

				{error && <p className="error">{error}</p>}

				{showDemoLogin ? (
					<div className="demo-login">
						<div className="login-divider">
							<span>OR</span>
						</div>
						<p className="login-code-hint">Viewer demo login — read-only, limited to 3 AI feedback requests per day.</p>
						<label className="login-field-label" htmlFor="demo-username">
							Username
						</label>
						<input
							id="demo-username"
							type="text"
							autoComplete="username"
							value={demoUsername}
							onChange={(e) => setDemoUsername(e.target.value)}
						/>
						<label className="login-field-label" htmlFor="demo-password">
							Password
						</label>
						<input
							id="demo-password"
							type="password"
							autoComplete="current-password"
							value={demoPassword}
							onChange={(e) => setDemoPassword(e.target.value)}
						/>
						<button onClick={handleDemoSignIn} disabled={!demoUsername.trim() || !demoPassword.trim() || demoLoading}>
							{demoLoading ? <LoadingSpinner label="Signing in..." /> : "Sign in as viewer"}
						</button>
						{demoError && <p className="error">{demoError}</p>}
					</div>
				) : (
					<button type="button" className="login-link-button demo-login-toggle" onClick={() => setShowDemoLogin(true)}>
						Sign in as a viewer instead?
					</button>
				)}
			</div>
		</div>
	);
}
