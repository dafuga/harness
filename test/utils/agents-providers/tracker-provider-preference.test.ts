import { expect, test } from 'vitest';
import { pickTrackerModel } from '../../../src/utils/agents-providers/pickTrackerModel';
import { retryTrackerModel } from '../../../src/utils/agents-providers/retryTrackerModel';
import { redirectTrackerRung } from '../../../src/utils/agents-providers/redirectTrackerRung';

const now = Date.parse('2026-11-28T12:00:00Z');
const until = '2026-11-29T12:00:00Z';
const on = { now, claudePreferredUntil: until };
const expired = { now: Date.parse(until), claudePreferredUntil: until };
const codex = { cli: 'codex', model: 'gpt-6.2-sol' };

test('maps every work kind to its Claude rung while the preference is on', () => {
	for (const [title, project, model, effort] of [
		['Add CSV export to the report', 'buildflexity', 'claude-sonnet-5-5', 'medium'],
		['Update the README', 'buildflexity', 'claude-sonnet-5-5', 'low'],
		['Add tests for the parser', 'buildflexity', 'claude-sonnet-5-5', 'low'],
		['Fix a race condition in the queue', 'buildflexity', 'claude-sonnet-5-5', 'high'],
		['[hard] Fix an intermittent crash', 'buildflexity', 'claude-sonnet-5-5', 'high'],
		['Add the parser module', 'harness', 'claude-haiku-5-5', 'medium'],
		['Deploy to preprod', 'buildflexity', 'claude-opus-5-5', 'high'],
		['Deploy to preprod', 'harness', 'claude-sonnet-5-5', 'high'],
		['Open the dashboard in Chrome', 'buildflexity', 'gpt-6.1-terra', 'medium'],
		['Update the README for the payments API', 'buildflexity', 'claude-sonnet-5-5', 'medium']
	]) {
		const picked = pickTrackerModel({ title, project }, on);
		expect(picked.rung, title).toMatchObject({ model, effort });
		expect(picked.reason, title).toContain(`Claude only until ${until}`);
	}
});

test('returns to Codex once the preference expires', () => {
	const item = { title: 'Add CSV export to the report' };
	expect(pickTrackerModel(item, on).rung.cli).toBe('claude');
	expect(pickTrackerModel(item, expired).rung).toMatchObject({ id: 'sol', effort: 'medium' });
	expect(pickTrackerModel({ ...item, model: 'sol' }, expired).rung.id).toBe('sol');
});

test('switches a Codex pin, keeps a Claude pin and keeps Codex for computer use', () => {
	const item = { title: 'Add CSV export' };
	expect(pickTrackerModel({ ...item, model: 'gpt-6.2-sol:medium' }, on)).toMatchObject({
		rung: { model: 'claude-sonnet-5-5', effort: 'medium', pinned: true },
		reason: expect.stringContaining('named gpt-6.2-sol:medium, switched to sonnet medium')
	});
	expect(pickTrackerModel({ ...item, model: 'opus' }, on).rung.id).toBe('opus');
	expect(
		pickTrackerModel({ title: 'Open the dashboard in Chrome', model: 'terra' }, on).rung.id
	).toBe('terra');
});

test('retries stay on Claude, including a retry of a pinned Codex attempt', () => {
	const item = { title: 'Add CSV export' };
	const previous = { rung: 'sol', model: 'gpt-6.2-sol', effort: 'medium' };
	expect(retryTrackerModel(item, previous, on)).toMatchObject({ id: 'sonnet', effort: 'medium' });
	expect(retryTrackerModel(item, { ...previous, pinned: true }, on).cli).toBe('claude');
	expect(
		retryTrackerModel(item, { rung: 'sonnet', model: 'claude-sonnet-5-5', effort: 'medium' }, on)
	).toMatchObject({ id: 'sonnet', effort: 'high' });
	expect(retryTrackerModel(item, previous, expired).cli).toBe('codex');
});

test('replaces only an earlier Codex choice, and only while the preference is on', () => {
	const item = { title: 'Add CSV export' };
	expect(redirectTrackerRung(item, codex, on)?.reason).toContain('gpt-6.2-sol replaced;');
	expect(redirectTrackerRung(item, { cli: 'claude', model: 'claude-opus-5-5' }, on)).toBeNull();
	expect(redirectTrackerRung(item, codex, expired)).toBeNull();
	expect(redirectTrackerRung({ title: 'Open the dashboard in Chrome' }, codex, on)).toBeNull();
});
