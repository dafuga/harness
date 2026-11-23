import type { Step } from './workflow.development-tooling-loop-lifecycle-list-open-loops.test.types';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	listOpenLoops,
	renderOpenLoops
} from '../../src/workflows/development-tooling/loop-lifecycle/listOpenLoops';
import type {
	OpenLoop,
	OpenLoopList
} from '../../src/workflows/development-tooling/loop-lifecycle/listOpenLoops.types';

const NOW = '2026-11-16T00:00:00.000Z';
const DAY_MS = 86_400_000;
const PENDING: Step[] = [{ id: 'a', title: 'Write parser', status: 'pending' }];
const DONE: Step[] = [{ id: 'a', title: 'Write parser', status: 'complete' }];
const MIXED: Step[] = [...PENDING, { id: 'b', title: 'Test parser', status: 'complete' }];
const CLOSED = { status: 'abandoned', reason: 'Dropped', closedAt: '2026-11-01T00:00:00.000Z' };

function daysAgo(days: number): string {
	return new Date(Date.parse(NOW) - days * DAY_MS).toISOString();
}

function loopFile(name: string, updatedAt: string, steps: Step[], extra = {}): string {
	const state = {
		name,
		goal: `Goal for ${name}`,
		createdAt: updatedAt,
		updatedAt,
		steps,
		...extra
	};
	return `${JSON.stringify(state, null, '\t')}\n`;
}

function seed(root: string, dir: string, body: string): void {
	const loopDir = join(root, 'specification', 'loops', dir);
	mkdirSync(loopDir, { recursive: true });
	writeFileSync(join(loopDir, 'loop.json'), body);
}

async function rejectionMessage(run: () => Promise<unknown>): Promise<string> {
	try {
		await run();
		return 'resolved';
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

test('Lists only open loops idle for the stale threshold', async () => {
	await withTempDir('list-open-loops-stale-', async (root) => {
		seed(root, 'old-open', loopFile('old-open', daysAgo(10), MIXED));
		seed(root, 'fresh-open', loopFile('fresh-open', daysAgo(1), PENDING));
		seed(root, 'old-closed', loopFile('old-closed', daysAgo(10), PENDING, { closed: CLOSED }));
		seed(root, 'old-done', loopFile('old-done', daysAgo(10), DONE));
		const list = await listOpenLoops({ root, now: () => NOW, staleDays: 7 });

		expect(list.loops.map((loop) => loop.name)).toEqual(['old-open']);
		expect(list.loops[0]).toMatchObject({ ageDays: 10, openSteps: 1, totalSteps: 2 });
		expect(list.unreadable).toEqual([]);
		recordExampleCases(
			{
				unitId: 'workflow.development-tooling-loop-lifecycle-list-open-loops',
				symbol: 'listOpenLoops',
				state: 'lists-only-open-loops-idle-for-the-stale-threshold',
				evidence: 'examples-cases',
				file: 'lists-only-open-loops-idle-for-the-stale-threshold.json'
			},
			[
				{
					name: 'staleDays 7 keeps only the open loop idle for 10 days',
					input: {
						staleDays: 7,
						seeded: ['old-open', 'fresh-open', 'old-closed', 'old-done']
					},
					output: list
				}
			]
		);
	});
});

test('Orders open loops by oldest activity first', async () => {
	await withTempDir('list-open-loops-order-', async (root) => {
		seed(root, 'mid', loopFile('mid', daysAgo(3), PENDING));
		seed(root, 'oldest', loopFile('oldest', daysAgo(9), PENDING));
		seed(root, 'newest', loopFile('newest', daysAgo(0), PENDING));
		const list = await listOpenLoops({ root, now: () => NOW });

		expect(list.loops.map((loop) => loop.name)).toEqual(['oldest', 'mid', 'newest']);
		expect(list.loops.map((loop) => loop.ageDays)).toEqual([9, 3, 0]);
		recordExampleCases(
			{
				unitId: 'workflow.development-tooling-loop-lifecycle-list-open-loops',
				symbol: 'listOpenLoops',
				state: 'orders-open-loops-by-oldest-activity-first',
				evidence: 'examples-cases',
				file: 'orders-open-loops-by-oldest-activity-first.json'
			},
			[
				{
					name: 'default threshold returns three open loops oldest first',
					input: { seeded: ['mid 3 days', 'oldest 9 days', 'newest 0 days'] },
					output: list
				}
			]
		);
	});
});

test('Keeps unreadable loops as diagnostics', async () => {
	await withTempDir('list-open-loops-unreadable-', async (root) => {
		seed(root, 'broken', '{not json');
		seed(root, 'renamed', loopFile('other', daysAgo(2), PENDING));
		seed(root, 'fine', loopFile('fine', daysAgo(2), PENDING));
		const list = await listOpenLoops({ root, now: () => NOW });

		expect(list.loops.map((loop) => loop.name)).toEqual(['fine']);
		expect(list.unreadable.map((item) => item.name)).toEqual(['broken', 'renamed']);
		expect(list.unreadable[0]?.error).toEqual(expect.any(String));
		expect(list.unreadable[1]).toEqual({
			name: 'renamed',
			error: 'Loop identity does not match its directory.'
		});
		recordExampleCases(
			{
				unitId: 'workflow.development-tooling-loop-lifecycle-list-open-loops',
				symbol: 'listOpenLoops',
				state: 'keeps-unreadable-loops-as-diagnostics',
				evidence: 'examples-cases',
				file: 'keeps-unreadable-loops-as-diagnostics.json'
			},
			[
				{
					name: 'invalid JSON and a mismatched name are kept as unreadable entries',
					input: { seeded: ['broken (invalid JSON)', 'renamed (name other)', 'fine'] },
					output: list
				}
			]
		);
	});
});

test('Renders loop rows and a heading for an empty stale list', () => {
	const open: OpenLoop = {
		name: 'old-open',
		goal: 'Ship parser',
		lastActivityAt: daysAgo(10),
		ageDays: 10,
		openSteps: 1,
		totalSteps: 2
	};
	const list: OpenLoopList = {
		loops: [open],
		unreadable: [{ name: 'broken', error: 'Unexpected token' }]
	};
	const rendered = renderOpenLoops(list);
	const emptyStale = renderOpenLoops({ loops: [], unreadable: [] }, 14);

	expect(rendered).toBe(
		'old-open  10d idle  1 open of 2 steps  Ship parser\nunreadable: broken (Unexpected token)'
	);
	expect(emptyStale).toBe('No idle for 14+ days loops.');
	expect(renderOpenLoops({ loops: [], unreadable: [] })).toBe('No open loops.');
	recordExampleCases(
		{
			unitId: 'workflow.development-tooling-loop-lifecycle-list-open-loops',
			symbol: 'renderOpenLoops',
			state: 'renders-loop-rows-and-a-heading-for-an-empty-stale-list',
			evidence: 'examples-cases',
			file: 'renders-loop-rows-and-a-heading-for-an-empty-stale-list.json'
		},
		[
			{
				name: 'one loop row followed by an unreadable diagnostic',
				input: { list, staleDays: 0 },
				output: rendered
			},
			{
				name: 'empty list with staleDays 14 uses the idle heading',
				input: { list: { loops: [], unreadable: [] }, staleDays: 14 },
				output: emptyStale
			}
		]
	);
});

test('Rejects a stale threshold that is not a whole number', async () => {
	await withTempDir('list-open-loops-invalid-', async (root) => {
		const inputs = [-1, 1.5];
		const messages: string[] = [];
		for (const staleDays of inputs) {
			messages.push(await rejectionMessage(() => listOpenLoops({ root, staleDays })));
		}

		expect(messages).toEqual([
			'Stale days must be a nonnegative whole number.',
			'Stale days must be a nonnegative whole number.'
		]);
		recordExampleCases(
			{
				unitId: 'workflow.development-tooling-loop-lifecycle-list-open-loops',
				symbol: 'listOpenLoops',
				state: 'rejects-a-stale-threshold-that-is-not-a-whole-number',
				evidence: 'examples-cases',
				file: 'rejects-a-stale-threshold-that-is-not-a-whole-number.json'
			},
			inputs.map((staleDays, index) => ({
				name: `staleDays ${staleDays} rejects before loops are read`,
				input: { staleDays },
				error: { message: messages[index] }
			}))
		);
	});
});
