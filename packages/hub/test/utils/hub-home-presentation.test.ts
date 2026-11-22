import { expect, test } from 'vitest';
import {
	initials,
	quickReplies,
	quotaReset,
	quotaSummary,
	runDay
} from '../../src/components/projects-sessions/hubHomePresentation';
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
			resetsAt: null
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
	expect(quotaSummary([subscription([5], stale)], now)).toBe('1 subscription · all OK');
	expect(quotaSummary([], now)).toBe('No subscriptions yet');
});

test('quick replies are offered only for yes-or-no questions', () => {
	expect(quickReplies('Approve the Nudge production window, Sat 09:00?')).toEqual([
		'Approve',
		'Not yet'
	]);
	expect(quickReplies('Should I merge the release PR?')).toEqual(['Yes', 'No']);
	expect(quickReplies('Which provider should Hub read quota from?')).toEqual([]);
	expect(quickReplies(null)).toEqual([]);
});
