import { describe, expect, test } from 'vitest';
import { homeWorkNow } from '../../../reports/src/lib/projects-sessions/hub-home/homeWorkNow';
import type { TrackerItemRecord } from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker.types';
import { stageLabel } from '../../../reports/src/components/projects-sessions/hub-home/hubHomeLive';

const at = '2026-11-26T18:00:00.000Z';

function item(fields: Partial<TrackerItemRecord>): TrackerItemRecord {
	return { id: 'item1', title: 'Task', status: 'in_progress', ...fields } as TrackerItemRecord;
}

describe('where a piece of work really is', () => {
	test('the latest milestone its owner noted, skipping Tracker and Hub notes after it', () => {
		const milestone = 'Browser proof is ready. '.repeat(8) + 'https://example.test/proof';
		const notes = [
			{ at, text: 'Started; branched from main.' },
			{ at, text: milestone },
			{ at, text: 'watchdog context: Session exceeded 150,000 tokens.' },
			{ at, text: 'auto-launch requested on harbor-mbp-2' },
			{ at, text: 'Hub message: please hurry' }
		];
		const area = 'Area claim on dafuga/harness by task (mac): src/launcher';
		expect(homeWorkNow(item({ notes_log: notes, area_claim: area }))).toBe(
			`${area} · ${milestone}`
		);
		expect(homeWorkNow(item({ notes_log: notes }))).toBe(milestone);
	});

	test('a blocked task says why, before any note', () => {
		const blocked = item({
			status: 'blocked',
			blocked_reason: 'waiting on kthwzz',
			notes_log: [{ at, text: 'Draft PR open.' }]
		});
		expect(homeWorkNow(blocked)).toBe('Blocked: waiting on kthwzz');
	});

	test('a note too long to send ends at a whole word and shows that it was cut', () => {
		const text = 'Browser checks passed on both widths. '.repeat(12).trim();
		for (const fields of [
			{ notes_log: [{ at, text }] },
			{ status: 'blocked' as const, blocked_reason: text }
		]) {
			const now = homeWorkNow(item(fields))!.replace(/^Blocked: /, '');
			expect(now.length).toBeLessThanOrEqual(240);
			expect(now.endsWith('…')).toBe(true);
			const kept = now.slice(0, -1);
			expect(text.startsWith(`${kept} `)).toBe(true);
		}
		const short = 'Browser checks passed.';
		expect(homeWorkNow(item({ notes_log: [{ at, text: short }] }))).toBe(short);
	});

	test('nothing reported is shown as nothing, not guessed', () => {
		expect(homeWorkNow(item({}))).toBeNull();
		expect(homeWorkNow(item({ notes_log: [{ at, text: 'watchdog missing: no run' }] }))).toBeNull();
	});

	test('the default planning stage is not shown; a stage someone set is', () => {
		expect(stageLabel('idea')).toBeNull();
		expect(stageLabel(null)).toBeNull();
		expect(stageLabel('design')).toMatch(/^Stage: /);
	});
});
