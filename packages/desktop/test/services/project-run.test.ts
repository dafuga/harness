import { rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { RunCancelled, type AgentTurn } from '../../src/models/AgentRunner.types';
import type { ProjectRunRequest } from '../../src/models/DesktopBridge.types';
import { createPlanning } from '../../../planning/src/index/index';
import { fixture, git } from '../run-fixture';

type Fixture = Awaited<ReturnType<typeof fixture>>;
const badge = {
	category: 'components',
	title: 'Order badge',
	goal: 'Shows the state of one order.',
	proposal: 'A rounded badge with the state in words.',
	contract: {
		inputs: [{ name: 'state', type: 'OrderState' }],
		outputs: [{ name: 'badge', type: 'markup' }],
		errors: ['Unknown state']
	}
};
const asked = (f: Fixture): ProjectRunRequest => ({
	...{ intent: 'create', projectId: f.session.projectId!, category: 'functions', mode: 'plan' },
	...{ provider: 'codex', model: 'selected', effort: 'high', text: 'Add an order badge' }
});
const answers = (f: Fixture, before: (turn: AgentTurn) => Promise<void> | void = () => {}) =>
	f.run.mockImplementation(async (turn) => {
		await before(turn);
		return { text: JSON.stringify(badge), model: turn.model };
	});
async function settled(f: Fixture, request = asked(f)) {
	const started = await f.service.start(request);
	await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
	return started;
}
const head = (f: Fixture) => git(f.root, 'rev-parse', 'HEAD');
const planned = async (f: Fixture) =>
	(await f.planning.plans(head(f))).find((item) => item.title === badge.title);
const said = async (f: Fixture, plan: NonNullable<Awaited<ReturnType<typeof planned>>>) =>
	(await f.planning.messages(plan.id, plan.threads[0].id, head(f))).map((m) => [m.author, m.text]);
const kinds = (f: Fixture) => f.events.map((event) => event.kind);
const owned = (f: Fixture) => join(f.root, 'src/owned.ts');

test('the agent decides the kind: a component asked for among functions is planned with its contract', async () => {
	const f = await fixture();
	answers(f);
	// A case of one design: it asks for a single design option.
	const started = await settled(f, { ...asked(f), designOptions: 1 });
	const plan = (await planned(f))!;
	expect(plan.category).toBe('components');
	expect([plan.contract.inputs, plan.contract.outputs]).toEqual([
		badge.contract.inputs,
		badge.contract.outputs
	]);
	// What was written is the contract as it was authored; the states and viewports are not proposed.
	const kept = await (await createPlanning(f.root)).readPlan({ unitId: plan.id });
	expect(kept.contract).toEqual({
		...{ responsibility: badge.goal, ...badge.contract },
		...{ states: ['default'], viewports: ['desktop'] }
	});
	expect(plan.contract.hash).toBe(kept.contractHash);
	expect(plan.versions[0].images).toHaveLength(1);
	expect(
		[f.generator.generateImage, f.run].map((mock) => vi.mocked(mock).mock.calls.length)
	).toEqual([1, 1]);
	expect(f.run.mock.calls[0][0].prompt).toContain('Request:\nAdd an order badge');
	const created = { category: 'components', entityId: plan.id, threadId: plan.threads[0].id };
	expect(f.events.at(-1)).toEqual({
		...{ runId: started.runId, kind: 'finished', verified: false },
		summary: expect.stringContaining('Planned Order badge.'),
		created: { ...created, requestSaved: true }
	});
}, 20000);

test.each([
	['its thread could not be opened', 'openThread', false],
	['the request could not be written', 'appendMessage', false],
	['its image could not be made', 'generateImage', true]
] as const)(
	'a draft is named when %s, and it is not removed',
	async (_name, step, requestSaved) => {
		const f = await fixture();
		answers(f);
		const target = step === 'generateImage' ? f.generator : f.planning;
		vi.spyOn(target as never, step as never).mockRejectedValueOnce(new Error('It failed here.'));
		await settled(f);
		const plan = (await planned(f))!;
		const threadId = step === 'openThread' ? null : plan.threads[0].id;
		expect(f.events.at(-1)).toMatchObject({
			kind: 'failed',
			message: 'It failed here.',
			created: { category: 'components', entityId: plan.id, threadId, requestSaved }
		});
		expect([plan.versions, kinds(f).includes('finished')]).toEqual([[], false]);
		const expected = requestSaved
			? [
					['user', 'Add an order badge'],
					['agent', 'It failed here.']
				]
			: [];
		expect(threadId ? await said(f, plan) : []).toEqual(expected);
	},
	20000
);

test('a draft whose entity could not be read back holds the request and says what failed', async () => {
	const f = await fixture();
	answers(f);
	const catalog = f.session.requireProject().catalog;
	vi.spyOn(catalog, 'entity').mockRejectedValueOnce(new Error('The catalog could not be read.'));
	await settled(f);
	const plan = (await planned(f))!;
	const created = { entityId: plan.id, threadId: plan.threads[0].id, requestSaved: true };
	expect(f.events.at(-1)).toMatchObject({ kind: 'failed', created });
	expect(await said(f, plan)).toEqual([
		['user', 'Add an order badge'],
		['agent', 'The catalog could not be read.']
	]);
}, 20000);

test.each([
	['answered', async () => {}, 'failed'],
	['failed', async () => Promise.reject(new Error('The CLI stopped.')), 'failed'],
	['was cancelled', async () => Promise.reject(new RunCancelled()), 'cancelled']
] as const)(
	'what the agent wrote is told when it %s, and nothing is planned or undone',
	async (_name, end, kind) => {
		const f = await fixture();
		const before = head(f);
		answers(f, async () => {
			await writeFile(owned(f), 'changed by the agent');
			if (kind === 'cancelled') f.service.cancelActive();
			await end();
		});
		const started = await settled(f);
		expect(f.events).toContainEqual({
			...{ runId: started.runId, kind: 'changes' },
			files: [{ path: 'src/owned.ts', change: 'modified' }]
		});
		const last = f.events.at(-1)!;
		expect(last.kind).toBe(kind);
		if (last.kind === 'failed')
			expect(last.message).toContain('nothing was planned: src/owned.ts.');
		else expect(last).toEqual({ runId: started.runId, kind: 'cancelled' });
		expect([head(f), await readFile(owned(f), 'utf8')]).toEqual([before, 'changed by the agent']);
	},
	20000
);

test('a file the CLI said it wrote outside the project is told with its hash, and nothing is planned', async () => {
	const f = await fixture();
	const outside = join(tmpdir(), `harness-outside-${Date.now()}.txt`);
	answers(f, async (turn) => {
		await writeFile(outside, 'written outside');
		turn.onFile?.(outside);
	});
	try {
		await settled(f);
		const last = f.events.at(-1)!;
		expect(last.kind === 'failed' ? last.message : '').toMatch(
			new RegExp(
				`nothing was planned: .*${outside.split('/').at(-1)} \\(reported by the CLI, sha256 [a-f0-9]{12}\\)`
			)
		);
		expect(await planned(f)).toBeUndefined();
	} finally {
		await rm(outside, { force: true });
	}
}, 20000);
