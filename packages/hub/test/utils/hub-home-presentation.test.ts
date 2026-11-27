import { expect, test } from 'vitest';
import {
	initials,
	quotaReset,
	quotaSummary,
	runDay
} from '../../../reports/src/components/projects-sessions/hub-home/hubHomePresentation';
import { quotaPills } from '../../../reports/src/components/projects-sessions/hub-home/hubQuotaPills';
import type { HomeSubscription } from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';

const now = Date.parse('2026-11-21T22:30:00Z');

function subscription(left: number[], readAt = new Date(now - 120_000).toISOString()) {
	return {
		id: `sub-${left.join('-')}`,
		provider: 'codex',
		plan: null,
		account: null,
		readAt,
		limits: left.map((value, index) => ({
			id: `limit-${index}`,
			label: 'Weekly',
			left: value,
			resetsAt: null as string | null
		})),
		credits: null,
		history: [],
		agents: []
	} satisfies HomeSubscription;
}

test('avatar initials use the first and last word of the agent name', () => {
	expect(['Chief of Staff', 'Grok Bot', 'Research', 'Release bot'].map(initials)).toEqual([
		'CS',
		'GB',
		'R',
		'RB'
	]);
});

test('reset lines name the reset clock time and the countdown', () => {
	expect(quotaReset('2026-11-22T01:10:00Z', now)).toBe('Resets 01:10 · in 2h 40m');
	expect(quotaReset('2026-11-23T09:00:00Z', now)).toBe('Resets Mon 09:00 · in 1d 10h');
	expect(quotaReset(null, now)).toBe('Reset time unknown');
});

test('schedule days beyond tomorrow carry their weekday', () => {
	expect(runDay('2026-11-21T23:00:00Z', now)).toBe('Today');
	expect(runDay('2026-11-22T09:00:00Z', now)).toBe('Tomorrow');
	expect(runDay('2026-11-23T10:00:00Z', now)).toBe('Mon 23 Nov');
});

test('the quota dialog summary counts subscriptions and readable low limits', () => {
	const stale = new Date(now - 3 * 3_600_000).toISOString();
	expect(quotaSummary([subscription([64, 18]), subscription([85])], now)).toBe(
		'2 subscriptions · 1 running low'
	);
	expect(quotaSummary([subscription([64])], now)).toBe('1 subscription · all OK');
	expect(quotaSummary([subscription([0, 18])], now)).toBe(
		'1 subscription · 1 out of quota · 1 running low'
	);
	expect(quotaSummary([subscription([5], stale)], now)).toBe('1 subscription · all OK');
	expect(quotaSummary([], now)).toBe('No subscriptions yet');
});

test('an empty limit names its Lisbon reset, in summer time too, or says it is unknown', () => {
	const summer = Date.parse('2026-07-01T08:00:00Z');
	const pill = (resetsAt: string | null) => {
		const codex = subscription([0], new Date(summer - 120_000).toISOString());
		codex.limits = [{ ...codex.limits[0], resetsAt }];
		return quotaPills([codex], summer).find((entry) => entry.id === codex.id)!;
	};
	expect(pill('2026-07-01T09:39:00Z')).toMatchObject({
		level: 'out',
		text: 'Codex weekly · resets Wed 1 Jul 10:39 Lisbon'
	});
	expect(pill(null).text).toBe('Codex weekly · reset time unknown');
	expect(pill('2026-07-01T07:00:00Z').text).toBe('Codex weekly · reset due');
});

test('model limits stay out of a pill until they run low, and then lead it', () => {
	const claude = {
		...subscription([]),
		id: 'claude',
		provider: 'claude' as const,
		limits: [
			{ id: 'session', label: '5-hour window', left: 62, resetsAt: null },
			{ id: 'weekly-opus', label: 'Weekly Opus', left: 4, resetsAt: null },
			{ id: 'weekly-sonnet', label: 'Weekly Sonnet', left: 90, resetsAt: null }
		]
	};
	const [pill, codex] = quotaPills([claude], now);
	expect(pill).toMatchObject({
		level: 'critical',
		text: 'Claude weekly Opus 4% left · 5h 62% left'
	});
	expect(pill.meaning).toContain(
		'Claude weekly Opus: Anthropic Claude Code subscription weekly limit for Opus.'
	);
	expect(codex).toMatchObject({ level: null, text: 'Codex usage unknown' });
});
