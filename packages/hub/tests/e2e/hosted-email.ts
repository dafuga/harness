import { ada, clientId } from './hosted-data';
import type { Answer, HostedCall, HostedState } from './hosted-fixture';

export const thirdPartyCredential = 'fixture-third-party-credential';
export const emailCode = '24681012';
export const unsent = { email: ada.email, sent: false, expiresAt: null };

const pending = (state: HostedState): Answer => ({
	json: { actor: null, emailProof: state.email.proof }
});

function start(state: HostedState): Answer {
	if (!state.email.proof) return { status: 401, json: { error: 'email-proof-required' } };
	if (!state.email.delivery) return { status: 503, json: { error: 'email-delivery-disabled' } };
	state.email.proof = { ...state.email.proof, sent: true, expiresAt: '2026-10-12T12:10:00.000Z' };
	return pending(state);
}

function verify(state: HostedState, call: HostedCall): Answer {
	if (!state.email.proof?.sent || call.body?.code !== emailCode)
		return { status: 400, json: { error: 'email-code-invalid' } };
	state.email.proof = null;
	state.signedIn = true;
	return { json: { actor: ada } };
}

/** An address Google does not vouch for: pending until its code is verified, signed in only then. */
export function emailAnswer(state: HostedState, call: HostedCall): Answer | null {
	if (call.path === '/api/auth/email/start') return start(state);
	if (call.path === '/api/auth/email/verify') return verify(state, call);
	if (call.path === '/api/auth/google' && call.body?.credential === thirdPartyCredential) {
		state.email.proof = unsent;
		return pending(state);
	}
	if (!state.email.proof) return null;
	if (call.path === '/api/auth/status')
		return { json: { actor: null, configured: true, clientId, emailProof: state.email.proof } };
	if (call.path !== '/api/auth/logout') return null;
	state.email.proof = null;
	return { json: { ok: true } };
}
