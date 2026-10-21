import type { SignInResult } from '../models/HubAuth.types';
import { BROWSER_TTL } from '../repositories/SessionRepository';
import { PENDING_TTL } from '../services/email-proof-service/EmailProofService';
import type { EmailProofService } from '../services/email-proof-service/EmailProofService';
import type { RequestSessionService } from '../services/request-session-service/RequestSessionService';
import {
	EMAIL_PROOF_COOKIE,
	SESSION_COOKIE,
	authCookies,
	clearCookie,
	issueCookie
} from '../utils/authCookies';
import { authFail } from '../utils/authFail';
import { authHttp, hasAuthorization, readJson } from '../utils/authHttp';
import type { AuthRoutes } from '../utils/authHttp';
import { AuthRequestValidator } from '../validators/AuthRequestValidator';

export interface EmailProofControllerOptions {
	proofs: EmailProofService;
	sessions: RequestSessionService;
}

/** `/api/auth/email/*`. The code travels in a JSON body; the proof is found by its cookie alone. */
export class EmailProofController {
	private readonly input = new AuthRequestValidator();

	constructor(private readonly options: EmailProofControllerOptions) {}

	routes(): AuthRoutes {
		return {
			'POST /api/auth/email/start': (request) => this.start(request),
			'POST /api/auth/email/verify': (request) => this.verify(request)
		};
	}

	/** A browser's own pending proof: no bearer credential, and only from the public origin. */
	private proof(request: Request): string | null {
		if (hasAuthorization(request)) return authFail('email-proof-required');
		if (this.options.sessions.crossOrigin(request)) return authFail('origin-denied');
		return authCookies(request, EMAIL_PROOF_COOKIE);
	}

	private async start(request: Request): Promise<Response> {
		const cookie = this.proof(request);
		const result: SignInResult = {
			actor: null,
			emailProof: await this.options.proofs.start(cookie)
		};
		const kept = { maxAge: PENDING_TTL / 1000, sameSite: 'Strict' as const };
		return authHttp(result, { cookies: [issueCookie(EMAIL_PROOF_COOKIE, cookie ?? '', kept)] });
	}

	private async verify(request: Request): Promise<Response> {
		const cookie = this.proof(request);
		const code = this.input.emailCode(await readJson(request));
		const { credential, record } = await this.options.proofs.verify(cookie, code);
		const session = { maxAge: BROWSER_TTL / 1000, sameSite: 'Lax' as const };
		const cookies = [
			clearCookie(EMAIL_PROOF_COOKIE, 'Strict'),
			issueCookie(SESSION_COOKIE, credential, session)
		];
		const result: SignInResult = { actor: record.actor };
		return authHttp(result, { cookies });
	}
}
