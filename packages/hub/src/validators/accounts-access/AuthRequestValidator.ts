// @harness-uid u_le3fi5uzvj
import type { Body, JsonValue } from './AuthRequestValidator.types';
import { EMAIL_CODE_LENGTH } from '../../models/accounts-access/HubAuth.types';
import type {
	GoogleSignInInput,
	NativeApproveInput,
	NativeCallback,
	NativeExchangeInput,
	NativeStartInput
} from '../../models/accounts-access/HubAuth.types';
import { authFail } from '../../utils/accounts-access/authFail';
import { normalizeCode } from '../../lib/verification-evidence/server/auth/native-handoff-service/authSecrets';

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

function nativeCallback(value: unknown): NativeCallback {
	if (value === 'ios') return value;
	if (typeof value === 'number' && Number.isInteger(value) && value >= 1024 && value <= 65535)
		return value;
	return authFail('invalid-request');
}

function deviceName(value: unknown): string | undefined {
	if (value === undefined) return undefined;
	if (
		typeof value !== 'string' ||
		!value.trim() ||
		value.length > 80 ||
		/[\p{Cc}\p{Cf}]/u.test(value)
	)
		return authFail('invalid-request');
	return value.trim();
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
			...(body.callback === undefined ? {} : { callback: nativeCallback(body.callback) }),
			...(body.deviceName === undefined ? {} : { deviceName: deviceName(body.deviceName) }),
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
			...(body.callbackCode === undefined
				? {}
				: { callbackCode: field(body, 'callbackCode', S256_CHALLENGE) }),
			verifier: field(body, 'verifier', PKCE_VERIFIER),
			nonce: field(body, 'nonce', NONCE),
			resource: field(body, 'resource', RESOURCE)
		};
	}

	/** Null when GitHub reported a refusal or the callback is not one this server started. */
	deviceId(body: Body): string {
		return field(body, 'id', /^[A-Za-z0-9_-]{32,43}$/);
	}

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

	repositoryId(value: JsonValue): number {
		const valid = typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
		return valid ? value : authFail('invalid-request');
	}
}
