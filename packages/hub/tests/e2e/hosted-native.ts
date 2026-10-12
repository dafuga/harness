import type { Answer, HostedCall, HostedState } from './hosted-fixture';

export const handoff = 'handoff-1';
export const userCode = 'ABCD-EFGH';
const invalid: Answer = { status: 400, json: { error: 'handoff-invalid' } };

/** The two routes of the approval page: what is asked for, and the approval by a typed code. */
export function nativeAnswer(state: HostedState, call: HostedCall): Answer | null {
	if (!call.path.startsWith('/api/auth/native/')) return null;
	const known = call.body?.handoffId === handoff;
	if (call.path.endsWith('/poll')) return known ? { json: state.native } : invalid;
	if (!state.signedIn) return { status: 401, json: { error: 'session-required' } };
	const right = known && call.body?.userCode === userCode && state.native.status === 'pending';
	if (!right) return invalid;
	state.native.status = 'approved';
	return { json: { approved: true, resource: state.native.resource } };
}
