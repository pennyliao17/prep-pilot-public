import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setSessionToken, setUnauthorizedHandler } from "../api";

type AuthStatus = "loading" | "signed_out" | "signed_in" | "forbidden";

interface AuthContextValue {
	status: AuthStatus;
	email: string | null;
	// True only for a session issued by POST /api/auth/demo — the frontend's
	// own mirror of the backend's DEMO_ALLOWED_ROUTES restriction, used to
	// hide nav/pages the demo session can't reach anyway (the backend still
	// enforces this independently; this is UX, not the security boundary).
	isDemo: boolean;
	signIn: (token: string, email: string, role?: "demo") => void;
	signOut: () => void;
	forbidden: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_STORAGE_KEY = "session_token";
const EMAIL_STORAGE_KEY = "session_email";
const ROLE_STORAGE_KEY = "session_role";

export function AuthProvider({ children }: { children: ReactNode }) {
	const [status, setStatus] = useState<AuthStatus>("loading");
	const [email, setEmail] = useState<string | null>(null);
	const [isDemo, setIsDemo] = useState(false);

	useEffect(() => {
		const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
		const storedEmail = localStorage.getItem(EMAIL_STORAGE_KEY);
		if (storedToken && storedEmail) {
			setSessionToken(storedToken);
			setEmail(storedEmail);
			setIsDemo(localStorage.getItem(ROLE_STORAGE_KEY) === "demo");
			setStatus("signed_in");
		} else {
			setStatus("signed_out");
		}

		// The Worker verifies the session on every real API call — if a stored
		// token is expired or invalid, the first call will 401 and this callback
		// clears it, dropping the user back to the login gate.
		setUnauthorizedHandler(() => {
			localStorage.removeItem(TOKEN_STORAGE_KEY);
			localStorage.removeItem(EMAIL_STORAGE_KEY);
			localStorage.removeItem(ROLE_STORAGE_KEY);
			setEmail(null);
			setIsDemo(false);
			setStatus("signed_out");
		});

		return () => setUnauthorizedHandler(null);
	}, []);

	function signIn(token: string, signedInEmail: string, role?: "demo") {
		localStorage.setItem(TOKEN_STORAGE_KEY, token);
		localStorage.setItem(EMAIL_STORAGE_KEY, signedInEmail);
		if (role) localStorage.setItem(ROLE_STORAGE_KEY, role);
		else localStorage.removeItem(ROLE_STORAGE_KEY);
		setSessionToken(token);
		setEmail(signedInEmail);
		setIsDemo(role === "demo");
		setStatus("signed_in");
	}

	function signOut() {
		localStorage.removeItem(TOKEN_STORAGE_KEY);
		localStorage.removeItem(EMAIL_STORAGE_KEY);
		localStorage.removeItem(ROLE_STORAGE_KEY);
		setSessionToken(null);
		setEmail(null);
		setIsDemo(false);
		setStatus("signed_out");
	}

	function forbidden() {
		setStatus("forbidden");
	}

	return <AuthContext.Provider value={{ status, email, isDemo, signIn, signOut, forbidden }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
	return ctx;
}
