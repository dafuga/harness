import { expect, test, vi } from 'vitest';
import { withTempDir } from '../../support/temporary';
import { measureWorkload } from '../../support/measureWorkload';
import {
	codexComposer,
	composer,
	protectedPanes,
	trackerSlotFixture,
	verifyManualLaunchWithBlockedPane
} from '../../support/trackerSlotFixture';
import type { TrackerSlotFixture } from '../../support/trackerSlotFixture.types';
const noon = Date.parse('2026-11-25T12:00:00Z');
const minute = 60_000;
vi.setConfig({ testTimeout: 90_000 });
const running = { state: 'running', outcome: null };
const finished = (outcome: string) => ({ state: 'finished', outcome });
const slotCase = (name: string, prove: (fixture: TrackerSlotFixture) => Promise<void>) =>
	measureWorkload('service.projects-sessions-tracker-native-runtime', name, () =>
		withTempDir('hnt-slot-', async (root) => {
			const fixture = trackerSlotFixture(root, noon);
			try {
				await prove(fixture);
				expect(fixture.allPanes()).toEqual(expect.arrayContaining(protectedPanes));
			} finally {
				fixture.database.close();
			}
		})
	);

test('a finished run frees its slot, the queued run starts and the pane closes within a minute', () =>
	slotCase('finished-run-frees-slot', async (hub) => {
		hub.queue('first00001');
		hub.queue('second0001');
		await hub.advance(0);
		await hub.advance(5_000);
		expect(hub.runs('first00001')).toEqual([running]);
		expect(hub.runs('second0001')).toEqual([]);
		await hub.request('/items/first00001/done');
		hub.screen('auto-first0-r1', composer());
		await hub.advance(5_000);
		expect(hub.runs('first00001')).toEqual([finished('done')]);
		expect(hub.runs('second0001')).toEqual([running]);
		await hub.advance(35_000);
		expect(hub.panes()).toEqual(['auto-second-r2']);
	}));

test('a session idle with a final report finishes its run and is not relaunched', () =>
	slotCase('idle-final-report', async (hub) => {
		hub.queue('report0001');
		await hub.advance(0);
		await hub.request('/items/report0001/start');
		await hub.advance(5_000);
		await hub.request('/items/report0001/note', {
			text: 'stopped: waiting on an upstream release; resume from the notes'
		});
		hub.screen('auto-report-r1', composer());
		await hub.advance(14 * minute);
		expect(hub.runs('report0001')).toEqual([running]);
		hub.queue('queued0001');
		await hub.advance(2 * minute);
		await hub.advance(5_000);
		expect(hub.runs('report0001')).toEqual([finished('abandoned')]);
		expect(hub.runs('queued0001')).toEqual([running]);
		await hub.advance(35_000);
		expect(hub.panes()).toEqual(['auto-queued-r2']);
		await hub.request('/items/queued0001/done');
		for (let poll = 0; poll < 15; poll++) await hub.advance(2 * minute);
		expect(hub.runs('report0001')).toEqual([finished('abandoned')]);
	}));

async function verifyLiveAnswerDelivery(hub: TrackerSlotFixture) {
	for (const [item, model, prompt] of [
		['liveclaude', 'claude-sonnet-5-5:high', composer()],
		['livecodex0', 'gpt-6.2-sol:medium', codexComposer()]
	]) {
		hub.queue(item, model);
		await hub.advance(5_000);
		await hub.request(`/items/${item}/start`);
		await hub.request(`/items/${item}/flag`, {
			question: 'Choose the synthetic region',
			options: [
				{ label: 'First region', detail: 'Use the first synthetic region' },
				{ label: 'Second region', detail: 'Use the second synthetic region' }
			]
		});
		await hub.request(
			`/items/${item}/answer`,
			item === 'liveclaude' ? { answer: 'Synthetic free text' } : { option: 1 },
			'Chief of Staff'
		);
		await hub.advance(3 * minute);
		expect.soft(hub.runtime.watchdog!.alerts()).toContainEqual(
			expect.objectContaining({
				item_id: item,
				kind: 'answer-delivery'
			})
		);
		const name = hub.panes().find((pane) => pane.startsWith(`auto-${item.slice(0, 6)}-`))!;
		expect(name).toBeDefined();
		hub.screen(name, prompt);
		await hub.advance(minute);
		await hub.advance(minute);
		expect
			.soft(hub.tmuxInput().match(new RegExp(`Tracker answer for item ${item}`, 'g')) ?? [])
			.toHaveLength(1);
		const notes = hub.database.prepare('SELECT text FROM item_notes WHERE item_id = ?').all(item);
		expect
			.soft(notes.map(({ text }) => text))
			.toContainEqual(expect.stringContaining(`delivered to ${name}`));
		await hub.request(`/items/${item}/done`);
		await hub.advance(minute);
	}
}

async function verifyAnsweredPaneRetained(hub: TrackerSlotFixture) {
	const id = 'resumetest';
	hub.queue(id);
	await hub.advance(5_000);
	const name = hub.panes().find((pane) => pane.startsWith('auto-resume-'))!;
	expect(name).toBeDefined();
	await hub.request(`/items/${id}/start`);
	await hub.request(`/items/${id}/block`, { reason: 'Choose the synthetic region' });
	hub.screen(name, composer());
	await hub.advance(5_000);
	expect(hub.runs(id)).toEqual([finished('blocked')]);
	await hub.request(`/items/${id}/flag`, { question: 'Choose the synthetic region' });
	await hub.request(`/items/${id}/answer`, { answer: 'Use the first region' }, 'Chief of Staff');
	await hub.advance(minute);
	expect(hub.panes()).toContain(name);
	expect(hub.runs(id)).toEqual([running]);
	expect(hub.tmuxInput()).toContain(`Tracker answer for item ${id}`);
	await hub.request(`/items/${id}/done`);
	await hub.advance(minute);
}

test('a blocked run closes and stays down until its answer allows a relaunch', () =>
	slotCase('blocked-run-waits-for-answer', async (hub) => {
		hub.queue('blocked001');
		await hub.advance(0);
		await hub.request('/items/blocked001/start');
		await hub.request('/items/blocked001/block', { reason: 'Choose the synthetic region' });
		hub.screen('auto-blocke-r1', composer());
		await hub.advance(5_000);
		await hub.advance(35_000);
		expect(hub.panes()).toEqual([]);
		// Model a finished run with no closer receipt, such as after the provider exits itself.
		hub.database.exec("DELETE FROM meta WHERE k = 'tracker_closed_blocked_run:1'");
		await hub.request(
			'/items/blocked001/flag',
			{ question: 'Choose the synthetic region' },
			'Chief of Staff'
		);
		for (let poll = 0; poll < 15; poll++) await hub.advance(2 * minute);
		await hub.request('/items/blocked001/answer', { answer: 'Correct, wait', keep_blocked: true });
		for (let poll = 0; poll < 15; poll++) await hub.advance(2 * minute);
		expect(hub.item('blocked001').status).toBe('blocked');
		expect(hub.runs('blocked001')).toEqual([finished('blocked')]);
		await hub.request('/items/blocked001/answer', { answer: 'Use the first region' });
		await hub.advance(minute);
		expect.soft(hub.item('blocked001').status).toBe('in_progress');
		await hub.advance(minute);
		await hub.advance(5_000);
		expect.soft(hub.runs('blocked001')).toEqual([finished('blocked'), running]);
		await hub.request('/items/blocked001/done');
		await hub.advance(minute);
		await verifyLiveAnswerDelivery(hub);
		await verifyAnsweredPaneRetained(hub);
		await verifyManualLaunchWithBlockedPane(hub);
	}));

test('keeps a live background task until the item closes, then closes the pane', () =>
	slotCase('background-task-retained', async (hub) => {
		hub.queue('bgwork0001');
		hub.queue('later00001');
		await hub.advance(0);
		await hub.request('/items/bgwork0001/start');
		await hub.request('/items/bgwork0001/block', {
			reason: 'Upload waits for a scope',
			needs_daniel: false
		});
		hub.screen('auto-bgwork-r1', composer('  ⏵⏵ bypass permissions on · 1 shell · ↓ to manage'));
		await hub.advance(5_000);
		expect(hub.runs('later00001')).toEqual([running]);
		await hub.advance(20 * minute);
		expect(hub.panes()).toContain('auto-bgwork-r1');
		await hub.request('/items/bgwork0001/done');
		await hub.advance(5_000);
		expect(hub.panes()).not.toContain('auto-bgwork-r1');
	}));

test('closes a silent pane that never returns to its composer, but never a busy one', () =>
	slotCase('stuck-finished-pane', async (hub) => {
		hub.queue('stuck00001');
		await hub.advance(0);
		await hub.request('/items/stuck00001/done');
		await hub.advance(5_000);
		for (let poll = 0; poll < 12; poll++) {
			hub.screen('auto-stuck0-r1', 'Working (esc to interrupt)');
			await hub.advance(minute);
		}
		expect(hub.panes()).toEqual(['auto-stuck0-r1']);
		await hub.advance(10 * minute);
		expect(hub.panes()).toEqual([]);
	}));

test('a session that goes quiet again after the check-in is finished and stays down', () =>
	slotCase('idle-after-check-in', async (hub) => {
		hub.queue('quiet00001');
		await hub.advance(0);
		await hub.request('/items/quiet00001/start');
		hub.screen('auto-quiet0-r1', composer());
		await hub.advance(11 * minute);
		await hub.request('/items/quiet00001/note', {
			text: 'watchdog nudge 1/1 sent to auto-quiet0-r1 on daniel-primary-mbp'
		});
		await hub.advance(minute);
		hub.screen('auto-quiet0-r1', composer());
		await hub.advance(14 * minute);
		expect(hub.runs('quiet00001')).toEqual([running]);
		await hub.advance(2 * minute);
		for (let poll = 0; poll < 10; poll++) await hub.advance(2 * minute);
		expect(hub.runs('quiet00001')).toEqual([finished('abandoned')]);
		expect(hub.panes()).toEqual([]);
	}));
