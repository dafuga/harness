import { expect, test } from 'vitest';
import type {
	HomeLimit,
	HomeSubscription
} from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import { stripQuota } from '../../../reports/src/components/projects-sessions/hub-home/hubStripQuota';
import { runTime } from '../../../reports/src/components/projects-sessions/hub-home/hubHomeTime';

const now = Date.parse('2026-11-21T22:30:00Z');
const fresh = new Date(now - 120_000).toISOString();
const stale = new Date(now - 7_200_000).toISOString();
const inThreeHours = new Date(now + 3 * 3_600_000).toISOString();
const mondayMorning = '2026-11-23T10:00:00Z';

function limit(
	id: string,
	label: string,
	left: number,
	resetsAt: string | null = inThreeHours
): HomeLimit {
	return { id, label, left, resetsAt };
}

function reading(
	provider: HomeSubscription['provider'],
	readAt: string,
	limits: HomeLimit[]
): HomeSubscription {
	return {
		id: `${provider}-sample`,
		provider,
		plan: 'Sample plan',
		account: 'sample-account',
		readAt,
		limits,
		credits: null,
		history: [],
		agents: []
	};
}

test('no subscriptions gives two entries with no reading', () => {
	const entries = stripQuota(null, now);
	expect(entries).toEqual([
		{
			provider: 'claude',
			name: 'Claude',
			window: '5 hour',
			left: null,
			tone: 'active',
			resets: 'No recent reading'
		},
		{
			provider: 'codex',
			name: 'Codex',
			window: 'weekly',
			left: null,
			tone: 'active',
			resets: 'No recent reading'
		}
	]);
});

test('an empty subscription list gives two entries with no reading', () => {
	const entries = stripQuota([], now);
	expect(entries.map((entry) => entry.left)).toEqual([null, null]);
	expect(entries.map((entry) => entry.resets)).toEqual(['No recent reading', 'No recent reading']);
});

test('Claude picks the 5-hour limit among several limits', () => {
	const [claude] = stripQuota(
		[
			reading('claude', fresh, [
				limit('weekly-all', 'Weekly', 12),
				limit('five-hour', '5-hour window', 64, inThreeHours)
			])
		],
		now
	);
	expect(claude).toEqual({
		provider: 'claude',
		name: 'Claude',
		window: '5 hour',
		left: 64,
		tone: 'active',
		resets: `resets ${runTime(inThreeHours)}`
	});
});

test('Codex picks the weekly limit and skips a per-model weekly limit', () => {
	const [, codex] = stripQuota(
		[
			reading('codex', fresh, [
				limit('weekly-gpt', 'GPT-5 limit', 5),
				limit('codex-plan', 'Plan', 40, mondayMorning)
			])
		],
		now
	);
	expect(codex?.left).toBe(40);
	expect(codex?.tone).toBe('active');
});

test('a stale reading is treated as no reading', () => {
	const [claude, codex] = stripQuota(
		[
			reading('claude', stale, [limit('five-hour', '5-hour window', 50)]),
			reading('codex', stale, [limit('weekly', 'Weekly', 50)])
		],
		now
	);
	expect(claude).toMatchObject({ left: null, tone: 'active', resets: 'No recent reading' });
	expect(codex).toMatchObject({ left: null, tone: 'active', resets: 'No recent reading' });
});

test('22 percent left is a warning', () => {
	const [claude] = stripQuota(
		[reading('claude', fresh, [limit('five-hour', '5-hour window', 22)])],
		now
	);
	expect(claude).toMatchObject({ left: 22, tone: 'warn' });
});

test('0 percent left is blocked', () => {
	const [claude] = stripQuota(
		[reading('claude', fresh, [limit('five-hour', '5-hour window', 0)])],
		now
	);
	expect(claude).toMatchObject({ left: 0, tone: 'blocked' });
});

test('a reset within the day shows the Lisbon clock time', () => {
	const [claude] = stripQuota(
		[reading('claude', fresh, [limit('five-hour', '5-hour window', 64, inThreeHours)])],
		now
	);
	expect(claude?.resets).toBe(`resets ${runTime(inThreeHours)}`);
});

test('a reset days away shows the Lisbon weekday', () => {
	const [, codex] = stripQuota(
		[reading('codex', fresh, [limit('weekly', 'Weekly', 70, mondayMorning)])],
		now
	);
	expect(codex?.resets).toBe('resets Mon');
});

test('a reset time already past shows reset due', () => {
	const [claude] = stripQuota(
		[
			reading('claude', fresh, [
				limit('five-hour', '5-hour window', 0, new Date(now - 60_000).toISOString())
			])
		],
		now
	);
	expect(claude?.resets).toBe('reset due');
});

test('a limit without a reset time shows resets unknown', () => {
	const [claude] = stripQuota(
		[reading('claude', fresh, [limit('five-hour', '5-hour window', 80, null)])],
		now
	);
	expect(claude?.resets).toBe('resets unknown');
});

test('the result is always Claude then Codex, whatever the input order', () => {
	const entries = stripQuota(
		[
			reading('codex', fresh, [limit('weekly', 'Weekly', 60, mondayMorning)]),
			reading('claude', fresh, [limit('five-hour', '5-hour window', 30)])
		],
		now
	);
	expect(entries.map((entry) => entry.provider)).toEqual(['claude', 'codex']);
});
