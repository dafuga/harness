// @harness-uid u_ycw5btxt23
import type * as View from './hubHomeBoardView.types';

const computers: Record<string, string> = {
	'daniel-primary-mbp': 'Primary Mac',
	'harbor-mbp-2': 'MacBook 2',
	'grok-box': 'Box'
};

/** @pure The name Daniel calls a computer by; an unknown one keeps its own. */
export function boardComputerName(name: string | null): string | null {
	return name && (computers[name] ?? name);
}

const families: Record<string, string> = {
	fable: 'Fable',
	opus: 'Opus',
	sonnet: 'Sonnet',
	haiku: 'Haiku',
	sol: 'Sol',
	terra: 'Terra',
	luna: 'Luna'
};

/** @pure "claude-opus-5-5:high" reads "Opus 5.5"; an unknown name is shown as recorded. */
export function boardModel(model: string | null): string | null {
	if (!model) return null;
	const [name] = model.split(':');
	const claude = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?/.exec(name);
	const gpt = /^gpt-(\d+(?:\.\d+)?)-([a-z]+)/.exec(name);
	const family = families[claude?.[1] ?? gpt?.[2] ?? name];
	if (!family) return name;
	const version = claude ? [claude[2], claude[3]].filter(Boolean).join('.') : gpt?.[1];
	return version ? `${family} ${version}` : family;
}

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** @pure A time as short as it can be and still be unambiguous. */
export function boardTime(value: string, now: number): string {
	const at = new Date(value);
	const days = Math.round(
		(new Date(at).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000
	);
	if (days === 0) return clock.format(at);
	if (days === -1) return 'Yesterday';
	if (days === 1) return `Tomorrow ${clock.format(at)}`;
	return Math.abs(days) < 7 ? weekday.format(at) : date.format(at);
}

/** @pure The card's top-right words. */
export function boardCardTime(card: View.BoardViewCard, now: number): string {
	const { column, due, row } = card;
	if (column === 'done') return boardTime(row.updatedAt, now);
	if (column === 'blocked') return card.ask ? '' : `since ${boardTime(row.updatedAt, now)}`;
	if (due) {
		if (Date.parse(due) < now) return `${column === 'progress' ? 'ETA' : 'Due'} passed`;
		return `${column === 'progress' ? 'ETA' : 'Due'} ${boardTime(due, now)}`;
	}
	if (column === 'progress') return row.startedAt ? `Started ${boardTime(row.startedAt, now)}` : '';
	return row.launchHold ? 'Launch paused' : row.runId ? 'Queued' : '';
}
