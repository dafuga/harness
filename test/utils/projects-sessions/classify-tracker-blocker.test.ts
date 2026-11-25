import { expect, test } from 'vitest';
import {
	classifyTrackerBlocker,
	escalatesToDaniel,
	trackerBlockerRoute
} from '../../../src/utils/projects-sessions/classifyTrackerBlocker';

const cases: [string, 'block' | 'flag', string][] = [
	[
		'Automatic GitHub filing requires an approved credential path; the scoped secret is absent',
		'block',
		'credential_access'
	],
	['Needs access to the Cloudflare account', 'block', 'credential_access'],
	['GitHub Actions billing is exhausted', 'block', 'payment_cost'],
	['Which option should we pick for the sync design?', 'flag', 'daniel_decision'],
	['Please confirm the plan', 'flag', 'daniel_decision'],
	['Waiting for the vendor to reply', 'block', 'external_person'],
	['waiting on Andriy for the transcript', 'block', 'external_person'],
	['waiting on c41n4y to land first', 'block', 'waiting_on_item'],
	['depends on item xcqgpb', 'block', 'waiting_on_item'],
	['waiting on review', 'block', 'technical'],
	['the tokenizer test fails on CI', 'block', 'technical']
];

test.each(cases)('classifies %s as %s', (text, kind, type) => {
	expect(classifyTrackerBlocker(text, kind).type).toBe(type);
});

test('a flag without a cue is still a Daniel decision, a block is technical', () => {
	expect(classifyTrackerBlocker('plain words', 'flag').type).toBe('daniel_decision');
	expect(classifyTrackerBlocker('plain words').type).toBe('technical');
	expect(classifyTrackerBlocker(null).type).toBe('technical');
});

test('names the item a blocker waits on', () => {
	expect(classifyTrackerBlocker('blocked by fx4c15').waitsOn).toBe('fx4c15');
	expect(classifyTrackerBlocker('blocked by review').waitsOn).toBeNull();
});

test('credential, decision and cost blockers route to Daniel; the rest do not', () => {
	expect(
		['credential_access', 'daniel_decision', 'payment_cost'].map((t) =>
			trackerBlockerRoute(t as never)
		)
	).toEqual(['needs_daniel', 'needs_daniel', 'needs_daniel']);
	expect(trackerBlockerRoute('technical')).toBe('orchestrator');
	expect(trackerBlockerRoute('external_person')).toBe('owner');
	expect(trackerBlockerRoute('waiting_on_item')).toBe('dependency');
	expect(escalatesToDaniel('technical')).toBe(false);
});
