import { expect, test } from 'vitest';
import { WatchdogStartupService } from '../../../src/services/projects-sessions/WatchdogStartupService';
import type { StartupScan } from '../../../src/services/projects-sessions/WatchdogStartupService.types';
import {
	codexTrust,
	host,
	item,
	minute,
	now,
	pane,
	recordWatchdogOutcome,
	run
} from './watchdog-fixtures';

const service = new WatchdogStartupService();
const workspace = '/tmp/fixture';
const capture = pane({ screen: codexTrust, cwd: workspace });
const active = run({ startedAt: now - minute });
const proof = { canonicalRepo: workspace, ownedBySourceRepo: true, alreadyAttempted: false };
const input = {
	host,
	now,
	items: [item()],
	runs: [active],
	panes: [capture],
	trustByRun: new Map([[active.id, proof]])
} satisfies StartupScan;
const reason = `Codex is waiting at its folder trust prompt in ${capture.name}. Chief of Staff, please inspect the pane and resolve the prompt.`;
const identity = `${capture.key}:codex:folder trust`;

test('plans one eligible trust decision scoped to the attested recent launch', () => {
	const planned = {
		actions: [
			{
				id: item().id,
				pane: capture.name,
				paneKey: capture.key,
				runId: active.id,
				kind: 'folder trust',
				action: 'trust'
			}
		],
		clearAlerts: []
	};
	const actual = service.plan({ ...input, panes: [capture, capture] });
	expect(actual).toEqual(planned);
	recordWatchdogOutcome('startup', actual);
	expect(service.plan({ ...input, items: [item({ status: 'open' })] })).toEqual(planned);
});

test('alerts on trust ineligible through attachment, selection, age, flags or unverified ownership', () => {
	const states: Partial<StartupScan>[] = [
		{ panes: [{ ...capture, attached: true }] },
		{ panes: [{ ...capture, ready: false }] },
		{ panes: [{ ...capture, cwd: '/tmp/other' }] },
		{ runs: [{ ...active, startedAt: now - 2 * minute }] },
		{ runs: [{ ...active, resumedAt: now }] },
		{ trustByRun: new Map([[active.id, { ...proof, alreadyAttempted: true }]]) },
		{ trustByRun: new Map([[active.id, { ...proof, ownedBySourceRepo: false }]]) },
		{ items: [item({ needsDaniel: true, question: 'a separate operator question' })] }
	];
	for (const state of states) {
		expect(service.plan({ ...input, ...state }).actions[0]).toMatchObject({
			action: 'alert',
			kind: 'folder trust',
			reason,
			identity,
			question: state.items ? null : `${host}: ${reason}`,
			writeAlert: true
		});
	}
	expect(
		service.plan({
			...input,
			panes: [pane({ name: 'auto-abc123', screen: codexTrust, cwd: workspace })]
		}).actions[0]?.action
	).toBe('alert');
	expect(service.plan({ ...input, runs: [{ ...active, cli: 'claude' }] }).actions).toEqual([]);
});

test('preserves alerts on read failure, deduplicates alerts and clears only its matching question', () => {
	const previous = {
		...input,
		trustByRun: new Map(),
		previousAlerts: [{ id: item().id, reason, identity }],
		items: [item({ needsDaniel: true, question: `${host}: ${reason}` })]
	};
	expect(service.plan(previous).actions[0]).toMatchObject({
		action: 'alert',
		writeAlert: false,
		question: null
	});
	expect(service.plan({ ...previous, panes: [{ ...capture, screen: null }] })).toEqual({
		actions: [],
		clearAlerts: []
	});
	expect(service.plan({ ...previous, itemId: 'unrelated', panes: [] }).clearAlerts).toEqual([]);
	expect(service.plan({ ...previous, panes: [pane()] }).clearAlerts).toEqual([
		{ id: item().id, clearQuestion: true }
	]);
	expect(
		service.plan({
			...previous,
			panes: [pane()],
			items: [item({ needsDaniel: true, question: 'separate question' })]
		}).clearAlerts
	).toEqual([{ id: item().id, clearQuestion: false }]);
});
