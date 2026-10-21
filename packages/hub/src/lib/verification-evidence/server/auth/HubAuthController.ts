import type { Actor } from 'collaboration';
import type { AuthStatus, SignInResult } from '../../../../models/accounts-access/HubAuth.types';
import { BROWSER_TTL } from '../../../../repositories/projects-sessions/SessionRepository';
import type { SessionRepository } from '../../../../repositories/projects-sessions/SessionRepository';
import { PENDING_TTL } from '../../../../services/verification-evidence/email-proof-service/EmailProofService';
import type { EmailProofService } from '../../../../services/verification-evidence/email-proof-service/EmailProofService';
import type { GoogleIdentityService } from './GoogleIdentityService';
import { CHALLENGE_TTL } from '../../../../services/accounts-access/LoginChallengeService';
import type { LoginChallengeService } from '../../../../services/accounts-access/LoginChallengeService';
import type { RequestSessionService } from './request-session-service/RequestSessionService';
import {
	CHALLENGE_COOKIE,
	EMAIL_PROOF_COOKIE,
	SESSION_COOKIE,
	authCookies,
	clearCookie,
	issueCookie
} from '../../../../utils/accounts-access/authCookies';
import { authFail } from '../../../../utils/accounts-access/authFail';
import {
	authFailure,
	authHttp,
	authPath,
	hasAuthorization,
	readJson
} from '../../../../utils/verification-evidence/authHttp';
import type { AuthRoute, AuthRoutes } from '../../../../utils/verification-evidence/authHttp';
import { AuthRequestValidator } from '../../../../validators/accounts-access/AuthRequestValidator';

export interface HubAuthControllerOptions {
	clientId: string;
	sessions: RequestSessionService;
	repository: SessionRepository;
	challenges: LoginChallengeService;
	google: GoogleIdentityService;
	emailProofs: EmailProofService;
	/** Native handoff and GitHub connection routes. */
	routes: AuthRoutes;
}

/** HTTP entry for `/api/auth/*` and `/api/github/*`. Takes a Request, returns a Response. */
export class HubAuthController {
	private readonly input = new AuthRequestValidator();
	private readonly routes: Map<string, AuthRoute>;

	constructor(private readonly options: HubAuthControllerOptions) {
		this.routes = new Map<string, AuthRoute>([
			['GET /api/auth/status', (request) => this.status(request)],
			['POST /api/auth/challenge', (request) => this.challenge(request)],
			['POST /api/auth/google', (request) => this.google(request)],
			['POST /api/auth/logout', (request) => this.logout(request)],
			...Object.entries(options.routes)
		]);
	}

	/** Null for paths outside the two namespaces. Every failure becomes a coded JSON error. */
	async handle(request: Request): Promise<Response | null> {
		const path = authPath(request);
		if (path === null) return null;
		try {
			return await this.route(request, path)(request);
		} catch (error) {
			return authFailure(error);
		}
	}

	private route(request: Request, path: string): AuthRoute {
		const route = this.routes.get(`${request.method} ${path}`);
		if (route) return route;
		const known = [...this.routes.keys()].some((key) => key.endsWith(` ${path}`));
		return authFail(known ? 'method-not-allowed' : 'not-found');
	}

	private async status(request: Request): Promise<Response> {
		const session = await this.options.sessions.resolve(request);
		const pending = session ? null : authCookies(request, EMAIL_PROOF_COOKIE);
		const emailProof = await this.options.emailProofs.status(pending);
		const status: AuthStatus = {
			actor: session?.actor ?? null,
			configured: true,
			clientId: this.options.clientId,
			...(emailProof ? { emailProof } : {})
		};
		return authHttp(status);
	}

	private async challenge(request: Request): Promise<Response> {
		if (this.options.sessions.crossOrigin(request)) return authFail('origin-denied');
		const { cookie, challenge } = await this.options.challenges.issue();
		const options = { maxAge: CHALLENGE_TTL / 1000, sameSite: 'Strict' as const };
		return authHttp(challenge, { cookies: [issueCookie(CHALLENGE_COOKIE, cookie, options)] });
	}

	/** Origin, then body shape, then the one-time challenge, then Google's signature. */
	private async google(request: Request): Promise<Response> {
		const { sessions, challenges, google, emailProofs } = this.options;
		if (sessions.crossOrigin(request)) return authFail('origin-denied');
		const body = this.input.google(await readJson(request));
		const nonce = await challenges.consume(authCookies(request, CHALLENGE_COOKIE), body.csrf);
		const identity = await google.verify(body.credential, nonce);
		const direct = identity.authoritative || (await emailProofs.proven(identity.actor));
		return direct ? this.signedIn(identity.actor) : this.pending(identity.actor);
	}

	private async signedIn(actor: Actor): Promise<Response> {
		const grant = { kind: 'browser' as const, actor, resource: 'projects', parentHash: null };
		const { credential } = await this.options.repository.issue(grant);
		const session = { maxAge: BROWSER_TTL / 1000, sameSite: 'Lax' as const };
		const cookies = [
			issueCookie(SESSION_COOKIE, credential, session),
			clearCookie(CHALLENGE_COOKIE, 'Strict'),
			clearCookie(EMAIL_PROOF_COOKIE, 'Strict')
		];
		const result: SignInResult = { actor };
		return authHttp(result, { cookies });
	}

	/** The address still has to be proven: a pending-proof cookie and no session of any kind. */
	private async pending(actor: Actor): Promise<Response> {
		const { cookie, status } = await this.options.emailProofs.open(actor);
		const kept = { maxAge: PENDING_TTL / 1000, sameSite: 'Strict' as const };
		const cookies = [
			issueCookie(EMAIL_PROOF_COOKIE, cookie, kept),
			clearCookie(CHALLENGE_COOKIE, 'Strict'),
			clearCookie(SESSION_COOKIE, 'Lax')
		];
		const result: SignInResult = { actor: null, emailProof: status };
		return authHttp(result, { cookies });
	}

	/** Revokes the presented session with what it approved, and ends a pending email proof. */
	private async logout(request: Request): Promise<Response> {
		const { sessions, repository, emailProofs } = this.options;
		const native = hasAuthorization(request);
		if (!native && sessions.crossOrigin(request)) return authFail('origin-denied');
		const session = await sessions.resolve(request);
		if (session) await repository.revoke(session);
		if (native) return authHttp({ ok: true });
		await emailProofs.cancel(authCookies(request, EMAIL_PROOF_COOKIE));
		const cookies = [clearCookie(EMAIL_PROOF_COOKIE, 'Strict'), clearCookie(SESSION_COOKIE, 'Lax')];
		return authHttp({ ok: true }, { cookies });
	}
}
