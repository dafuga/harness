import type {
	PairedAccountCall,
	PairedInstall,
	PairedMode,
	PairedShell
} from './projectOverviewPairedFixture.types';

export function pairedReply(status: number, body: unknown) {
	return { status, contentType: 'application/json', data: btoa(JSON.stringify(body)) };
}

/**
 * The overview answer for the Nth read: a non-owner is denied, a denied owner keeps the card for the
 * landing confirmation and the page's own read, and loses it on the third (a focus refresh).
 */
export function pairedOverviewReply(mode: PairedMode, snapshot: unknown, read: number) {
	if (mode === 'non-owner') return pairedReply(403, { error: 'permission-denied' });
	if (mode === 'denied' && read > 2) return pairedReply(403, { error: 'permission-denied' });
	if (mode === 'unavailable') return pairedReply(503, { status: 'unavailable' });
	return pairedReply(200, snapshot);
}

/** The `HarnessAccount` double: every request is recorded; the overview is its only read. */
export function pairedAccount(
	shell: PairedShell,
	input: PairedInstall,
	calls: PairedAccountCall[]
) {
	const owner = {
		configured: true,
		state: 'signed-in',
		actor: { id: 'google:fixture-owner', name: 'Fixture Owner', email: 'owner@example.invalid' }
	};
	const accountStatus = () =>
		shell.account === 'signed-in'
			? owner
			: {
					configured: true,
					state: shell.account,
					verificationCode: shell.account === 'waiting-for-approval' ? '018427' : undefined,
					handoff:
						shell.account === 'pending'
							? {
									userCode: '',
									verificationUrl: 'https://fixture.invalid/native/fixture?return=1',
									expiresAt: new Date(Date.now() + 300_000).toISOString(),
									interval: 1
								}
							: undefined
				};
	return {
		...(input.mode === 'approve' ? { deviceApproval: pairedApproval(shell) } : {}),
		status: async () => {
			if (shell.account === 'approval-denied' || shell.account === 'approval-expired')
				throw Object.assign(new Error(shell.account), { code: shell.account });
			return accountStatus();
		},
		connect: async (input: { google?: boolean }) => {
			if (!input.google) throw new Error('Expected Google sign-in.');
			shell.account = 'pending';
			return accountStatus();
		},
		disconnect: async () => {
			shell.account = 'signed-out';
			return accountStatus();
		},
		/** Records each request: the overview is read with one fixed GET and nothing else. */
		request: async (call: { method: string; path: string }) => {
			calls.push({ method: call.method, path: call.path });
			if (call.method !== 'GET') return pairedReply(405, { error: 'method-not-allowed' });
			if (call.path === '/api/tracker-overview')
				return pairedOverviewReply(input.mode, input.snapshot, ++shell.reads);
			return pairedReply(200, []);
		}
	};
}

/** Synthetic bridge results for renderer-only testing of the approval dialog. */
export function pairedApproval(shell: PairedShell) {
	const approvals = [
		{ id: 'a'.repeat(32), platform: 'mac', country: 'PT', createdAt: Date.UTC(2026, 10, 27, 18) },
		{ id: 'b'.repeat(32), platform: 'web', createdAt: Date.UTC(2026, 10, 27, 19) }
	];

	let firstReview = true;
	return async (call: { action: string; id?: string; code?: string }) => {
		if (shell.account !== 'signed-in') throw new Error('Sign in to review devices.');
		if (call.action === 'list') return { requests: approvals.slice() };
		const index = approvals.findIndex((item) => item.id === call.id);
		if (index < 0) throw new Error('Unknown request.');
		if (call.action === 'review') {
			if (firstReview) {
				firstReview = false;
				return { state: 'waiting' };
			}
			return { state: 'compare', code: '053817' };
		}
		if (call.action === 'approve' && call.code !== '053817') throw new Error('Wrong code.');
		approvals.splice(index, 1);
		return { state: call.action === 'deny' ? 'denied' : 'approved' };
	};
}
