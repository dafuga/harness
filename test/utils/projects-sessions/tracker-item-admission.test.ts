import { expect, test } from 'vitest';
import { planTrackerItemMutation as plan } from '../../../src/utils/projects-sessions/planTrackerItemMutation';
import { context, item, now } from './trackerItemFixture';

test('duplicate guards prioritize ignored items and recognize pending questions', () => {
	const candidate = { ...item, id: 'candidate', status: 'open', needs_daniel: 0 };
	const scoped = { ...context, candidates: [item, candidate] };
	expect(plan({ action: 'flag', item }, scoped).fields).toEqual({ needs_daniel: 1, resolved: 0 });
	const flag = () =>
		plan(
			{ action: 'flag', item },
			{ ...context, candidates: [{ ...candidate, needs_daniel: 1, resolved: 0 }] }
		);
	expect(flag).toThrow(
		expect.objectContaining({
			status: 409,
			body: expect.objectContaining({ code: 'open_duplicate' })
		})
	);
	const blocked = {
		...scoped,
		candidates: [candidate, { ...candidate, id: 'ignored', status: 'ignored' }]
	};
	const add = { action: 'add', itemId: item.id, body: { title: item.title } } as const;
	expect(() => plan(add, blocked)).toThrow(
		expect.objectContaining({
			status: 409,
			body: expect.objectContaining({ code: 'ignored_duplicate' })
		})
	);
	expect(plan({ ...add, body: { ...add.body, force: true } }, blocked).fields.title).toBe(
		item.title
	);
});

test('invalid transitions report the same request errors before any receipt is returned', () => {
	expect(() => plan({ action: 'add', itemId: item.id }, context)).toThrow('title is required');
	expect(() => plan({ action: 'update', item }, context)).toThrow('nothing to update');
	expect(() => plan({ action: 'note', item }, context)).toThrow('note text required');
	expect(() => plan({ action: 'progress', item }, context)).toThrow('progress text required');
	expect(() => plan({ action: 'answer', item }, context)).toThrow('answer text required');
	expect(() => plan({ action: 'done', item, body: { failed: true } }, context)).toThrow(
		'--failed is only for recurring items'
	);
	expect(() => plan({ action: 'done', item: { ...item, every: '@hourly' } }, context)).toThrow(
		'no occurrence of this recurring item has come due yet'
	);
	expect(() => plan({ action: 'ignore', item, body: { reason: ' ' } }, context)).toThrow(
		'ignore needs --reason "<why>"'
	);
	expect(() => plan({ action: 'unignore', item }, context)).toThrow(
		expect.objectContaining({ status: 409, message: 'item item-f is not ignored (status blocked)' })
	);
});

test('update rechecks duplicates for a new question and preserves the flag alias truthiness', () => {
	const other = { ...item, id: 'other', resolved: 0 };
	const scope = { ...context, candidates: [other] };
	expect(() => plan({ action: 'update', item, body: { needs_daniel: '0' } }, scope)).toThrow(
		expect.objectContaining({
			status: 409,
			body: expect.objectContaining({ code: 'open_duplicate' })
		})
	);
	expect(
		plan({ action: 'update', item: { ...item, resolved: 0 }, body: { question: '   ' } }, scope)
			.fields
	).toEqual({ needs_daniel: 1, resolved: 0, question: '' });
});

test('launch and model collaborators receive the original command context', () => {
	const project = 'fixture-project';
	const model = 'fixture-model';
	const scope = {
		...context,
		validateModel: (receivedModel: unknown, receivedProject: unknown) => {
			expect([receivedModel, receivedProject]).toEqual([model, project]);
		},
		planLaunch: (fields: Readonly<Record<string, unknown>>) => ({
			...fields,
			auto: true,
			computer: 'fixture-target',
			launch_target: 'fixture-target',
			launch_source: 'manual'
		})
	};
	const current = { ...item, project };
	expect(
		plan({ action: 'update', item: current, body: { auto: true, model } }, scope).fields
	).toEqual({
		auto: `fixture-node@${now}#fixture-nonce`,
		model,
		explicit_model: model,
		computer: 'fixture-target',
		launch_target: 'fixture-target',
		launch_source: 'manual'
	});
});
