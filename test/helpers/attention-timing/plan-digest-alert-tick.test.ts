import { expect, test } from 'vitest';
import { planDigestAlertTick } from '../../../src/helpers/attention-timing/planDigestAlertTick';
import type { DigestItem } from '../../../src/helpers/attention-timing/planDigestAlertTick.types';

// Artificial clocks only. November is on Lisbon winter time (UTC+0), so 14:05Z reads 14:05 Lisbon.
const NOON = Date.parse('2026-11-21T14:05:00Z');

const flagged = (id: string, extra: Partial<DigestItem> = {}): DigestItem => ({
	id,
	agent: 'harness',
	title: `title ${id}`,
	question: null,
	status: 'open',
	needs_daniel: true,
	deleted: false,
	...extra
});

const PREFIX =
	'30-MIN STATUS TICK 14:05 Lisbon (automated, from tracker-alert.py, not typed by Daniel). ';
const SUFFIX =
	' Give Daniel the 30-minute status per the tracker skill (every project one line, resources, quota, To unblock list); handle routing yourself; then wait for his instructions.';

test('an empty digest reports no new items and a zero total', () => {
	const plan = planDigestAlertTick({ nowMs: NOON, mode: 'tick', items: [], seenIds: [] });
	expect(plan.message).toBe(
		`${PREFIX}No new needs-Daniel items since last tick. Open needs-Daniel total: 0.${SUFFIX}`
	);
	expect(plan.flaggedCount).toBe(0);
	expect(plan.newIds).toEqual([]);
	expect(plan.nextSeenIds).toEqual([]);
});

test('a changed digest lists only the items not seen before, with the open total', () => {
	const items = [flagged('aaa111'), flagged('bbb222', { question: 'Approve deploy?' })];
	const plan = planDigestAlertTick({
		nowMs: NOON,
		mode: 'tick',
		items,
		seenIds: ['aaa111']
	});
	expect(plan.newIds).toEqual(['bbb222']);
	expect(plan.message).toBe(
		`${PREFIX}New since last tick: [bbb222] harness: Approve deploy?. Open needs-Daniel total: 2.${SUFFIX}`
	);
	expect(plan.nextSeenIds).toEqual(['aaa111', 'bbb222']);
});

test('a line uses the question when present and falls back to the title', () => {
	const plan = planDigestAlertTick({
		nowMs: NOON,
		mode: 'tick',
		items: [flagged('ccc333', { question: '', title: 'Fallback title' })],
		seenIds: []
	});
	expect(plan.message).toContain('New since last tick: [ccc333] harness: Fallback title.');
});

test('only open needs-Daniel items count: closed, ignored, deleted and unflagged items are dropped', () => {
	const plan = planDigestAlertTick({
		nowMs: NOON,
		mode: 'tick',
		items: [
			flagged('open01'),
			flagged('done01', { status: 'done' }),
			flagged('ign001', { status: 'ignored' }),
			flagged('del001', { deleted: true }),
			flagged('quiet1', { needs_daniel: false })
		],
		seenIds: []
	});
	expect(plan.flaggedCount).toBe(1);
	expect(plan.newIds).toEqual(['open01']);
	expect(plan.nextSeenIds).toEqual(['open01']);
});

test('grouping is deterministic: the same digest in any order renders the same message', () => {
	const items = [flagged('zzz999'), flagged('aaa111'), flagged('mmm555')];
	const forward = planDigestAlertTick({ nowMs: NOON, mode: 'tick', items, seenIds: [] });
	const reversed = planDigestAlertTick({
		nowMs: NOON,
		mode: 'tick',
		items: [...items].reverse(),
		seenIds: []
	});
	expect(reversed.message).toBe(forward.message);
	expect(forward.newIds).toEqual(['aaa111', 'mmm555', 'zzz999']);
});

test('a duplicated item id counts once', () => {
	const plan = planDigestAlertTick({
		nowMs: NOON,
		mode: 'tick',
		items: [flagged('dup001', { question: 'first' }), flagged('dup001', { question: 'second' })],
		seenIds: []
	});
	expect(plan.flaggedCount).toBe(1);
	expect(plan.message).toContain('[dup001] harness: second');
});

test('more than six new items show six and count the rest', () => {
	const items = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'].map((id) => flagged(id));
	const plan = planDigestAlertTick({ nowMs: NOON, mode: 'tick', items, seenIds: [] });
	expect(plan.message).toContain(
		'New since last tick: [a1] harness: title a1 | [a2] harness: title a2 | [a3] harness: title a3 | ' +
			'[a4] harness: title a4 | [a5] harness: title a5 | [a6] harness: title a6 (+2 more).'
	);
	expect(plan.message).not.toContain('a7');
	expect(plan.newIds).toHaveLength(8);
});

test('safe text: whitespace and control characters collapse, long fields are cut to their limits', () => {
	const plan = planDigestAlertTick({
		nowMs: NOON,
		mode: 'tick',
		items: [
			flagged('ctl001', {
				agent: '  a long\n\tagent name\u001b[31m  ',
				question: 'line one\r\nline two\u0007 ' + 'x'.repeat(200)
			})
		],
		seenIds: []
	});
	const line = plan.message?.split('New since last tick: ')[1].split('.')[0] ?? '';
	expect(line).toBe(`[ctl001] a long agent na: line one line two ${'x'.repeat(142)}`);
});

test('safe text cuts by code point, so an emoji is never split', () => {
	const plan = planDigestAlertTick({
		nowMs: NOON,
		mode: 'tick',
		items: [flagged('emo001', { agent: '🚀'.repeat(20), question: 'ok' })],
		seenIds: []
	});
	expect(plan.message).toContain(`[emo001] ${'🚀'.repeat(15)}: ok`);
});

test('the next tick is one 30-minute interval after now', () => {
	const plan = planDigestAlertTick({ nowMs: NOON, mode: 'tick', items: [], seenIds: [] });
	expect(plan.nextTickAtMs - NOON).toBe(30 * 60 * 1000);
});

test('the message matches the original tracker-alert.py output byte for byte on an artificial digest', () => {
	const ids = ['k00x', 'k01x', 'k02x', 'k03x', 'k04x', 'k05x', 'k06x', 'k07x'];
	const plan = planDigestAlertTick({
		nowMs: NOON,
		mode: 'tick',
		items: ids.map((id) => flagged(id)),
		seenIds: ['k00x']
	});
	expect(plan.message).toBe(
		`${PREFIX}New since last tick: [k01x] harness: title k01x | [k02x] harness: title k02x | ` +
			'[k03x] harness: title k03x | [k04x] harness: title k04x | [k05x] harness: title k05x | ' +
			`[k06x] harness: title k06x (+1 more). Open needs-Daniel total: 8.${SUFFIX}`
	);
});
