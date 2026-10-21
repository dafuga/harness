import { measureWorkload } from '../../../../test/support/measureWorkload';
import { expect, test } from 'vitest';
import { taskProfile } from '../../../../test/support/taskProfiles';
import { RemoteFailure } from '../../src/models/Remote.types';
import { RemoteInputValidator } from '../../src/validators/RemoteInputValidator';

const validator = new RemoteInputValidator(),
	client = { kind: 'ios', name: 'Fixture phone' },
	projectId = 'local-' + 'a'.repeat(64),
	commit = 'c'.repeat(40),
	pairingId = 'b'.repeat(32);
function code(run: () => unknown): string {
	try {
		run();
	} catch (error) {
		if (error instanceof RemoteFailure) return error.code;
	}
	return 'accepted';
}

test('attach names protocol 1, a client and a resume point or null', () => {
	const fresh = { protocol: 1, client, resume: null },
		resumed = { protocol: 1, client, resume: { epoch: 'ab12'.repeat(8), sequence: 7 } };
	expect(validator.attach(fresh)).toEqual(fresh);
	expect(validator.attach(resumed)).toEqual(resumed);
	expect(code(() => validator.attach({ ...fresh, protocol: 2 }))).toBe('protocol-unsupported');
	const refused: unknown[] = [
		{},
		{ protocol: 1 },
		{ protocol: 1, client },
		{ ...fresh, client: { kind: 'web', name: 'x' } },
		{ ...fresh, client: { kind: 'ios', name: '' } },
		{ ...fresh, client: { kind: 'ios', name: 'n'.repeat(81) } },
		{ ...fresh, resume: { epoch: 'x', sequence: 1 } },
		{ ...fresh, resume: { epoch: 'ab12'.repeat(8), sequence: -1 } },
		{ ...fresh, resume: { epoch: 'ab12'.repeat(8), sequence: 1.5 } },
		{ ...fresh, token: 'x' }
	];
	for (const input of refused) expect(code(() => validator.attach(input))).toBe('invalid-message');
});
test('a device request names a registered local project, never a hosted one or a path', () => {
	expect(validator.projectId({ projectId })).toBe(projectId);
	expect(code(() => validator.projectId({}))).toBe('project-required');
	for (const bad of ['../etc', '/Users/x/repo', 'a6196e55-8746-4bc5-bfeb-5e2c8771e241', 5, null])
		expect(code(() => validator.projectId({ projectId: bad }))).toBe('project-denied');
});
test('a change names the branch and the full commit it applies to', () => {
	const revision = { branch: 'feat/a', commit };
	expect(validator.revision({ revision })).toEqual(revision);
	expect(code(() => validator.revision({}))).toBe('revision-required');
	const refused: unknown[] = [
		{ branch: '', commit },
		{ branch: 'main', commit: 'abc' },
		{ branch: 'main', commit: commit.toUpperCase() },
		{ branch: 'b'.repeat(256), commit },
		{ branch: 'main' },
		'main'
	];
	for (const bad of refused)
		expect(code(() => validator.revision({ revision: bad }))).toBe('revision-required');
});
test('control inputs are exact', () =>
	measureWorkload('remote.validator.remote-input', 'approval-input-validation', async () => {
		const deviceId = 'd'.repeat(40),
			approval = { pairingId, deviceId, projectIds: [projectId], agents: true };
		expect(validator.approval(approval)).toEqual(approval);
		expect(validator.approval({ ...approval, agents: false, comments: false })).toMatchObject({
			agents: false,
			comments: false
		});
		expect(validator.approval({ ...approval, comments: true })).toMatchObject({
			agents: true,
			comments: true
		});
		expect(code(() => validator.approval({ ...approval, comments: false }))).toBe(
			'invalid-message'
		);
		expect(validator.pairing({ pairingId })).toEqual({ pairingId });
		expect(validator.device({ deviceId: 'd'.repeat(40) })).toEqual({ deviceId: 'd'.repeat(40) });
		const refused: unknown[] = [
			{ ...approval, comments: null },
			{ ...approval, comments: 'yes' },
			{ ...approval, projectIds: [] },
			{ ...approval, projectIds: [projectId, projectId] },
			{ ...approval, projectIds: ['a6196e55-8746-4bc5-bfeb-5e2c8771e241'] },
			{ ...approval, projectIds: Array.from({ length: 65 }, () => projectId) },
			{ ...approval, agents: 'yes' },
			{ ...approval, pairingId: 'nope' },
			{ projectIds: [projectId], agents: true },
			{ pairingId, projectIds: [projectId], agents: true },
			{ ...approval, deviceId: 'D'.repeat(40) }
		];
		for (const input of refused)
			expect(code(() => validator.approval(input))).toBe('invalid-message');
		expect(code(() => validator.pairing({ pairingId: 'B'.repeat(32) }))).toBe('invalid-message');
		expect(code(() => validator.device({ deviceId: 'nope' }))).toBe('invalid-message');
		const projectIds = Array.from(
			{ length: 64 },
			(_, index) => 'local-' + index.toString(16).padStart(64, '0')
		);
		await taskProfile(
			'remote.validator.remote-input',
			'approve-64-distinct-projects-with-comments',
			() => validator.approval({ ...approval, projectIds, comments: true }),
			100
		);
	}));
