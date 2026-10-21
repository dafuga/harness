import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import type { RunRequest } from '../src/models/DesktopBridge.types';
import { fixture, git } from './run-fixture';
import { createPlanning } from '../../planning/src/lib/planning/index';

const proposal = {
	category: 'functions',
	title: 'Format elapsed time',
	goal: 'Format elapsed milliseconds for people.',
	proposal:
		'Input 1500 milliseconds returns 1.5 seconds. Reject negative values. Record these examples in behavior notes.',
	contract: {
		inputs: [{ name: 'milliseconds', type: 'number' }],
		outputs: [{ name: 'formatted', type: 'string' }],
		errors: ['negative-value']
	}
};

test('a project conversation creates the proposed function and retains its original request', async () => {
	const f = await fixture();
	f.run.mockImplementation(async (turn) => ({ text: JSON.stringify(proposal), model: turn.model }));
	const request = {
		intent: 'create',
		category: 'functions',
		mode: 'plan',
		provider: 'codex',
		model: 'selected',
		effort: 'high',
		projectId: f.session.projectId!,
		text: 'Add a shared function that formats elapsed milliseconds for people.'
	};
	const started = await f.service.start(request as unknown as RunRequest);
	await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
	const plans = await f.planning.plans(git(f.root, 'rev-parse', 'HEAD'));
	const created = plans.find((plan) => plan.title === proposal.title);
	expect(created).toMatchObject({ category: 'functions', goal: proposal.goal });
	const entity = await f.session
		.requireProject()
		.catalog.entity(created!.id, git(f.root, 'rev-parse', 'HEAD'));
	expect(entity).toMatchObject({ category: 'functions', summary: proposal.goal, hasPlan: true });
	const stored = await (await createPlanning(f.root)).readPlan({ unitId: created!.id });
	expect(stored.contract).toMatchObject(proposal.contract);
	expect(created!.contract.hash).toBe(stored.contractHash);
	expect(created!.versions).toHaveLength(1);
	expect(created!.versions[0].images).toEqual([]);
	expect(created!.versions[0].notes).toContain('1500 milliseconds');
	expect(f.generator.generateImage).not.toHaveBeenCalled();
	expect(f.run).toHaveBeenCalledOnce();
	expect(f.run.mock.calls[0][0]).toMatchObject({
		access: 'read-only',
		cwd: f.root,
		model: 'selected'
	});
	const messages = await f.planning.messages(
		created!.id,
		created!.threads[0].id,
		git(f.root, 'rev-parse', 'HEAD')
	);
	expect(messages).toContainEqual(expect.objectContaining({ author: 'user', text: request.text }));
	expect(f.events).toContainEqual(
		expect.objectContaining({ runId: started.runId, kind: 'finished', verified: false })
	);
	expect(git(f.root, 'status', '--porcelain')).toBe('');
}, 60000);

test('an invalid creation proposal creates no plan and emits no success', async () => {
	const f = await fixture();
	f.run.mockImplementation(async (turn) => ({
		text: '{"category":"functions","title":"../outside"}',
		model: turn.model
	}));
	const before = git(f.root, 'rev-parse', 'HEAD');
	await f.service.start({
		intent: 'create',
		category: 'functions',
		mode: 'plan',
		provider: 'codex',
		model: 'selected',
		effort: 'high',
		text: 'Add a formatter',
		projectId: f.session.projectId!
	} as unknown as RunRequest);
	await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
	expect(git(f.root, 'rev-parse', 'HEAD')).toBe(before);
	expect((await f.planning.plans(before)).map((plan) => plan.title)).toEqual(['Target']);
	expect(f.events.some((event) => event.kind === 'finished')).toBe(false);
	expect(f.events).toContainEqual(expect.objectContaining({ kind: 'failed' }));
}, 60000);
