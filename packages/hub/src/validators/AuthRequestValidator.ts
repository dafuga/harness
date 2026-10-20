import { EMAIL_CODE_LENGTH } from '../models/HubAuth.types';
import type {
	GoogleSignInInput,
	NativeApproveInput,
	NativeExchangeInput,
	NativeStartInput
} from '../models/HubAuth.types';
import { authFail } from '../utils/authFail';
import { normalizeCode } from '../services/native-handoff-service/authSecrets';

type Body = Record<string, unknown>;

const OPAQUE = /^[A-Za-z0-9_-]{32,128}$/;
const COMPACT_JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const S256_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const PKCE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
const NONCE = /^[A-Za-z0-9_-]{22,128}$/;
const RESOURCE = /^(?:projects|project:[A-Za-z0-9][A-Za-z0-9._-]{0,127})$/;
const USER_CODE = /^[A-HJ-NP-Z2-9]{8}$/;
const EMAIL_CODE = new RegExp(`^[0-9]{${EMAIL_CODE_LENGTH}}$`);
const OAUTH_CODE = /^[A-Za-z0-9_-]{1,200}$/;

function matches(value: unknown, pattern: RegExp, max = 200): value is string {
	return typeof value === 'string' && value.length <= max && pattern.test(value);
}

function field(body: Body, key: string, pattern: RegExp, max = 200): string {
	const value = body[key];
	return matches(value, pattern, max) ? value : authFail('invalid-request');
}

/** Parses request input into typed values or throws `invalid-request`. Unknown keys are dropped. */
export class AuthRequestValidator {
	google(body: Body): GoogleSignInInput {
		return {
			credential: field(body, 'credential', COMPACT_JWT, 4096),
			csrf: field(body, 'csrf', OPAQUE)
		};
	}

	nativeStart(body: Body): NativeStartInput {
		return {
			challenge: field(body, 'challenge', S256_CHALLENGE),
			nonce: field(body, 'nonce', NONCE),
			resource: field(body, 'resource', RESOURCE)
		};
	}

	nativeApprove(body: Body): NativeApproveInput {
		const typed =
			typeof body.userCode === 'string' ? normalizeCode(body.userCode.slice(0, 32)) : '';
		return {
			handoffId: field(body, 'handoffId', OPAQUE),
			userCode: field({ userCode: typed }, 'userCode', USER_CODE)
		};
	}

	nativePoll(body: Body): { handoffId: string } {
		return { handoffId: field(body, 'handoffId', OPAQUE) };
	}

	nativeExchange(body: Body): NativeExchangeInput {
		return {
			handoffId: field(body, 'handoffId', OPAQUE),
			verifier: field(body, 'verifier', PKCE_VERIFIER),
			nonce: field(body, 'nonce', NONCE),
			resource: field(body, 'resource', RESOURCE)
		};
	}

	/** Null when GitHub reported a refusal or the callback is not one this server started. */
	githubCallback(url: URL): { code: string; state: string } | null {
		const code = url.searchParams.get('code');
		const state = url.searchParams.get('state');
		if (!matches(code, OAUTH_CODE) || !matches(state, OPAQUE)) return null;
		return { code, state };
	}

	/** Eight digits. Spaces and dashes a person may type or paste are dropped first. */
	emailCode(body: Body): string {
		const typed = typeof body.code === 'string' ? body.code.slice(0, 32).replace(/[\s-]/g, '') : '';
		return field({ code: typed }, 'code', EMAIL_CODE);
	}

	repositoryId(value: unknown): number {
		const valid = typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
		return valid ? value : authFail('invalid-request');
	}
}
