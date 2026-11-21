import { describe, expect, test } from 'vitest';
import {
	labelsAtOpening,
	planGithubIssueIntake,
	scopeGithubIssueIntake
} from '../../../src/helpers/planning-collaboration/planGithubIssueIntake';
import type {
	GithubIssueIntakeEvent,
	GithubIssueIntakeIssue,
	GithubIssueIntakeSource
} from '../../../src/helpers/planning-collaboration/planGithubIssueIntake.types';

const ENABLED_AT = Date.parse('2026-11-02T00:00:00Z');
const BEFORE = '2026-11-01T10:00:00Z';
const AFTER = '2026-11-03T10:00:00Z';

function makeSource(overrides: Partial<GithubIssueIntakeSource> = {}): GithubIssueIntakeSource {
	return {
		target: 'example-org/example-repo',
		kind: 'task',
		auto_launch: 'unlabeled',
		enabled_at: ENABLED_AT,
		include_labels: [],
		exclude_labels: [],
		...overrides
	};
}

function makeIssue(overrides: Partial<GithubIssueIntakeIssue> = {}): GithubIssueIntakeIssue {
	return {
		id: 9001,
		number: 12,
		title: 'Sample report',
		state: 'open',
		created_at: AFTER,
		updated_at: '2026-11-04T08:00:00Z',
		labels: [],
		...overrides
	};
}

function label(event: string, name: string, at: string): GithubIssueIntakeEvent {
	return { id: `${event}-${name}-${at}`, event, created_at: at, label: { name } };
}

describe('scopeGithubIssueIntake', () => {
	test('skips pull requests and unsafe identifiers', () => {
		expect(scopeGithubIssueIntake(makeSource(), makeIssue({ pull_request: {} }))).toBeNull();
		expect(scopeGithubIssueIntake(makeSource(), makeIssue({ id: 2 ** 60 }))).toBeNull();
	});

	test('skips issues created before enablement unless backfilling open issues', () => {
		const old = makeIssue({ created_at: BEFORE, state: 'open' });
		expect(scopeGithubIssueIntake(makeSource(), old)).toBeNull();
		expect(scopeGithubIssueIntake(makeSource(), old, { backfill: true })).toEqual({
			historical: true,
			needsTimeline: false
		});
		expect(
			scopeGithubIssueIntake(makeSource(), makeIssue({ created_at: BEFORE, state: 'closed' }), {
				backfill: true
			})
		).toBeNull();
	});

	test('mapped issues bypass enablement and label filters and always read the timeline', () => {
		const source = makeSource({ include_labels: ['bug'], exclude_labels: ['wontfix'] });
		const old = makeIssue({ created_at: BEFORE, state: 'closed', labels: [{ name: 'wontfix' }] });
		expect(scopeGithubIssueIntake(source, old, { mapped: true })).toEqual({
			historical: true,
			needsTimeline: true
		});
	});

	test('include labels must all be present and exclude labels reject the issue', () => {
		const source = makeSource({ include_labels: ['bug', 'triage'], exclude_labels: ['duplicate'] });
		const withBoth = makeIssue({ labels: [{ name: 'Bug' }, { name: 'Triage' }] });
		expect(scopeGithubIssueIntake(source, withBoth)).not.toBeNull();
		expect(scopeGithubIssueIntake(source, makeIssue({ labels: [{ name: 'bug' }] }))).toBeNull();
		expect(
			scopeGithubIssueIntake(
				source,
				makeIssue({ labels: [{ name: 'bug' }, { name: 'triage' }, { name: 'DUPLICATE' }] })
			)
		).toBeNull();
	});
});

describe('planGithubIssueIntake identity', () => {
	test('keeps the external id, number key, title prefix and canonical url', () => {
		const record = planGithubIssueIntake(
			makeSource(),
			makeIssue({ title: 'Line one\nLine two' }),
			[]
		);
		expect(record).toMatchObject({
			externalId: '9001',
			key: '12',
			title: 'example-org/example-repo #12: Line one Line two',
			url: 'https://github.com/example-org/example-repo/issues/12',
			state: 'open',
			historical: false,
			snapshotAt: Date.parse('2026-11-04T08:00:00Z')
		});
	});

	test('bounds the title length after removing control characters', () => {
		const record = planGithubIssueIntake(
			makeSource(),
			makeIssue({ title: `\x07${'a'.repeat(400)}` }),
			[]
		);
		expect(record?.title.endsWith('a'.repeat(300))).toBe(true);
		expect(record?.title.length).toBe('example-org/example-repo #12: '.length + 300);
	});

	test('ignores a timeline for historical unmapped backfill issues', () => {
		const closed = { id: 5, event: 'closed', created_at: AFTER };
		expect(
			planGithubIssueIntake(makeSource(), makeIssue({ created_at: BEFORE }), [closed], {
				backfill: true
			})?.events
		).toEqual([]);
	});
});

describe('planGithubIssueIntake unlabeled launch intent', () => {
	const source = makeSource();

	test('marks an open, unlabeled task as auto launch with sync back', () => {
		const record = planGithubIssueIntake(source, makeIssue(), []);
		expect(record).toMatchObject({ autoLaunch: true, syncBack: true, historical: false });
	});

	test('does not auto launch non-task, non-unlabeled, closed or tracked issues', () => {
		const plain = makeIssue();
		expect(planGithubIssueIntake(makeSource({ kind: 'note' }), plain, [])?.autoLaunch).toBe(false);
		expect(
			planGithubIssueIntake(makeSource({ auto_launch: 'manual' }), plain, [])?.autoLaunch
		).toBe(false);
		expect(planGithubIssueIntake(source, makeIssue({ state: 'closed' }), [])?.autoLaunch).toBe(
			false
		);
		expect(
			planGithubIssueIntake(source, makeIssue({ labels: [{ name: 'Tracked' }] }), [])?.autoLaunch
		).toBe(false);
	});

	test('a label present at opening disables auto launch, but a later label does not', () => {
		const opened = makeIssue({ labels: [{ name: 'Bug' }] });
		expect(planGithubIssueIntake(source, opened, [])?.autoLaunch).toBe(false);
		const later = makeIssue({ labels: [{ name: 'Bug' }] });
		const timeline = [label('labeled', 'bug', '2026-11-03T12:00:00Z')];
		expect(planGithubIssueIntake(source, later, timeline)?.autoLaunch).toBe(true);
	});

	test('treats labels changed in the opening second as creation', () => {
		const issue = makeIssue({ labels: [{ name: 'Bug' }] });
		const timeline = [label('labeled', 'bug', AFTER)];
		expect(labelsAtOpening(issue, timeline).has('bug')).toBe(true);
		expect(planGithubIssueIntake(source, issue, timeline)?.autoLaunch).toBe(false);
	});

	test('reverses a later label removal so the label counts as opening state', () => {
		const issue = makeIssue({ labels: [] });
		const timeline = [
			label('labeled', 'bug', '2026-11-03T11:00:00Z'),
			label('unlabeled', 'bug', '2026-11-03T12:00:00Z')
		];
		expect(labelsAtOpening(issue, timeline).size).toBe(0);
		expect(planGithubIssueIntake(source, issue, timeline)?.autoLaunch).toBe(true);
		const removedLater = makeIssue({ labels: [] });
		expect(
			labelsAtOpening(removedLater, [label('unlabeled', 'bug', '2026-11-03T12:00:00Z')]).has('bug')
		).toBe(true);
	});

	test('ignores label events outside the issue creation and snapshot window', () => {
		const issue = makeIssue({ labels: [] });
		const timeline = [label('labeled', 'bug', '2026-11-05T00:00:00Z')];
		expect(labelsAtOpening(issue, timeline).size).toBe(0);
	});
});

describe('planGithubIssueIntake closure transition', () => {
	test('maps closed and reopened timeline events to state events and ignores other events', () => {
		const issue = makeIssue({ state: 'open' });
		const timeline: GithubIssueIntakeEvent[] = [
			{ id: 11, event: 'closed', created_at: '2026-11-03T13:00:00Z' },
			{ id: 12, event: 'reopened', created_at: '2026-11-03T14:00:00Z' },
			{ id: 13, event: 'commented', created_at: '2026-11-03T15:00:00Z' },
			{ id: 0, event: 'closed', created_at: '2026-11-03T16:00:00Z' },
			{ id: 14, event: 'closed', created_at: 'not-a-date' }
		];
		const record = planGithubIssueIntake(makeSource(), issue, timeline);
		expect(record?.events).toEqual([
			{ id: 'state:11', time: Date.parse('2026-11-03T13:00:00Z'), state: 'closed' },
			{ id: 'state:12', time: Date.parse('2026-11-03T14:00:00Z'), state: 'open' }
		]);
	});

	test('a closed issue with a closing event keeps its closed state', () => {
		const issue = makeIssue({ state: 'closed' });
		const timeline: GithubIssueIntakeEvent[] = [
			{ id: 21, event: 'closed', created_at: '2026-11-03T13:00:00Z' }
		];
		const record = planGithubIssueIntake(makeSource(), issue, timeline);
		expect(record).toMatchObject({ state: 'closed', autoLaunch: false });
		expect(record?.events).toHaveLength(1);
	});
});

describe('planGithubIssueIntake skipped issues', () => {
	test('returns null for issues that scope rejects', () => {
		expect(planGithubIssueIntake(makeSource(), makeIssue({ created_at: BEFORE }), [])).toBeNull();
	});
});
