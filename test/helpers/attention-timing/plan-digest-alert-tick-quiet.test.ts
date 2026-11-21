import { expect, test } from 'vitest';
import { planDigestAlertTick } from '../../../src/helpers/attention-timing/planDigestAlertTick';
import type { DigestItem } from '../../../src/helpers/attention-timing/planDigestAlertTick.types';

// Quiet hours, dry runs, init and unreadable digests. Artificial clocks only; November is UTC+0 in Lisbon.
const NOON = Date.parse('2026-11-21T14:05:00Z');
const NIGHT = Date.parse('2026-11-21T23:10:00Z');
const MORNING = Date.parse('2026-11-22T07:59:00Z');
const PREFIX =
	'30-MIN STATUS TICK 14:05 Lisbon (automated, from tracker-alert.py, not typed by Daniel). ';
const SUFFIX =
	' Give Daniel the 30-minute status per the tracker skill (every project one line, resources, quota, To unblock list); handle routing yourself; then wait for his instructions.';

const flagged = (id: string): DigestItem => ({
	id,
	agent: 'harness',
	title: `title ${id}`,
	question: null,
	status: 'open',
	needs_daniel: true,
	deleted: false
});

test('an unreadable tracker sends the unreachable tick and persists nothing', () => {
	const plan = planDigestAlertTick({ nowMs: NOON, mode: 'tick', items: null, seenIds: ['old001'] });
	expect(plan.message).toBe(
		`${PREFIX}Local tracker unreachable this tick. Open needs-Daniel total: 0.${SUFFIX}`
	);
	expect(plan.nextSeenIds).toBeNull();
});

test('quiet hours hold the tick back: no message and nothing persisted', () => {
	for (const nowMs of [NIGHT, MORNING]) {
		const plan = planDigestAlertTick({
			nowMs,
			mode: 'tick',
			items: [flagged('qh0001')],
			seenIds: []
		});
		expect(plan.quietHeld).toBe(true);
		expect(plan.message).toBeNull();
		expect(plan.nextSeenIds).toBeNull();
	}
});

test('quiet hours end at 08:00 Lisbon, which is a normal tick again', () => {
	const at0800 = Date.parse('2026-11-22T08:00:00Z');
	const plan = planDigestAlertTick({ nowMs: at0800, mode: 'tick', items: [], seenIds: [] });
	expect(plan.quietHeld).toBe(false);
	expect(plan.message).toContain('30-MIN STATUS TICK 08:00 Lisbon');
});

test('a dry run renders the message in quiet hours and never persists', () => {
	const plan = planDigestAlertTick({
		nowMs: NIGHT,
		mode: 'dry-run',
		items: [flagged('dry001')],
		seenIds: []
	});
	expect(plan.quietHeld).toBe(false);
	expect(plan.message).toContain('New since last tick: [dry001] harness: title dry001.');
	expect(plan.nextSeenIds).toBeNull();
});

test('init records the seen ids without a message, even in quiet hours', () => {
	const plan = planDigestAlertTick({
		nowMs: NIGHT,
		mode: 'init',
		items: [flagged('init01')],
		seenIds: ['old001']
	});
	expect(plan.message).toBeNull();
	expect(plan.newIds).toEqual(['init01']);
	expect(plan.nextSeenIds).toEqual(['init01', 'old001']);
});

test('the seen set keeps ids that are no longer flagged, as the original script does', () => {
	const plan = planDigestAlertTick({
		nowMs: NOON,
		mode: 'tick',
		items: [flagged('still1')],
		seenIds: ['gone01', 'still1']
	});
	expect(plan.nextSeenIds).toEqual(['gone01', 'still1']);
	expect(plan.newIds).toEqual([]);
});
