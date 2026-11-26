import { describe, expect, test } from 'vitest';
import { homeWorkNow } from '../../../reports/src/lib/projects-sessions/hub-home/homeWorkNow';
import type { TrackerItemRecord } from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker.types';
import { stageLabel } from '../../src/components/projects-sessions/hubHomeLive';

const at = '2026-11-26T18:00:00.000Z';

function item(fields: Partial<TrackerItemRecord>): TrackerItemRecord {
	return { id: 'item1', title: 'Task', status: 'in_progress', ...fields } as TrackerItemRecord;
}

describe('where a piece of work really is', () => {
	test('the latest milestone its owner noted, skipping Tracker and Hub notes after it', () => {
		const notes = [
			{ at, text: 'Started; branched from main.' },
			{ at, text: 'PR #401 open; full check running.' },
			{ at, text: 'watchdog context: Session exceeded 150,000 tokens.' },
			{ at, text: 'auto-launch requested on harbor-mbp-2' },
			{ at, text: 'Hub message: please hurry' }
		];
		expect(homeWorkNow(item({ notes_log: notes }))).toBe('PR #401 open; full check running.');
	});

	test('a blocked task says why, before any note', () => {
		const blocked = item({
			status: 'blocked',
			blocked_reason: 'waiting on kthwzz',
			notes_log: [{ at, text: 'Draft PR open.' }]
		});
		expect(homeWorkNow(blocked)).toBe('Blocked: waiting on kthwzz');
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
