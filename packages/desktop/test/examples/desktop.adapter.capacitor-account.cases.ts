import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	accountIdentity,
	principal,
	publicStatus
} from '../../src/lib/verification-evidence/select-environment/capacitor-account-adapter/capacitorAccountCodec';
import type { AccountNativeStatus } from '../../src/models/development-tooling/Environment.types';

test('projects only public phone account status', () => {
	const handoff = {
		userCode: 'ABCD-EFGH',
		verificationUrl: 'https://hub.example/device',
		expiresAt: '2026-11-15T12:00:00Z',
		interval: 5
	};
	const actor = { id: 'hub-user-42', name: 'Jordan Lee', email: 'jordan@example.com' };
	const signedInStatus: AccountNativeStatus = {
		configured: true,
		state: 'signed-in',
		actor,
		handoff
	};
	const signedInInput = { ...signedInStatus, credential: 'native-fixture-only' };
	const pendingInput = { configured: true, state: 'pending', actor, handoff };
	const signedInPublic = publicStatus(signedInInput);
	const pendingPublic = publicStatus(pendingInput);
	const signedResult = {
		status: signedInPublic,
		identity: accountIdentity(signedInPublic),
		principal: principal(signedInPublic)
	};
	const pendingResult = {
		status: pendingPublic,
		identity: accountIdentity(pendingPublic),
		principal: principal(pendingPublic)
	};
	const waitingInput = {
		...pendingInput,
		state: 'waiting-for-approval',
		verificationCode: '018427'
	};
	const waitingPublic = publicStatus(waitingInput);
	expect(waitingPublic).toEqual({
		configured: true,
		state: 'waiting-for-approval',
		verificationCode: '018427'
	});
	expect(principal(waitingPublic)).toBeNull();
	for (const state of ['first-device', 'checking-device']) {
		expect(publicStatus({ ...waitingInput, state })).toEqual({ configured: true, state });
	}
	expect(publicStatus({ ...waitingInput, verificationCode: 'invalid' })).toEqual({
		configured: true,
		state: 'waiting-for-approval'
	});
	const unknownResult = { identity: accountIdentity(null), principal: principal(null) };

	expect(signedInPublic).toEqual({ configured: true, state: 'signed-in', actor });
	expect(pendingPublic).toEqual({ configured: true, state: 'pending', handoff });
	expect(signedResult.identity).toBe('["signed-in","hub-user-42"]');
	expect(pendingResult.principal).toBeNull();
	expect(unknownResult).toEqual({ identity: '[null,null]', principal: null });
	// prettier-ignore
	recordExampleCases({ unitId: 'desktop.adapter.capacitor-account', symbol: 'publicStatus', state: 'projects-only-public-phone-account-status', evidence: 'examples-cases', file: 'projects-only-public-phone-account-status.json' }, [
		{ name: 'project a signed-in account without plugin-only fields', input: signedInInput, output: signedResult },
		{ name: 'keep a handoff only while the account is pending', input: pendingInput, output: pendingResult },
		{ name: 'represent an unknown account', input: null, output: unknownResult }
	]);
});
