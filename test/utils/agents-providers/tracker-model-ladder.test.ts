import { expect, test } from 'vitest';
import { measureWorkload } from '../../support/measureWorkload';
import {
	pickTrackerModel,
	retryTrackerModel
} from '../../../src/utils/agents-providers/pickTrackerModel';

const visualModule = { title: 'Review module screenshots', agent: 'Harness' };
const sonnet = { id: 'sonnet', cli: 'claude', model: 'claude-sonnet-5-5', effort: 'medium' };

test('picks the lowest capable automatic rung in the Tracker ladder', () => {
	expect(pickTrackerModel(visualModule)).toMatchObject({
		rung: { id: 'haiku', effort: 'high' },
		kind: 'triage',
		reason: 'triage/small: haiku'
	});
	expect(pickTrackerModel({ title: 'Review screenshots' })).toMatchObject({
		rung: { id: 'terra', effort: 'medium' },
		reason: 'triage/small: terra'
	});
	expect(pickTrackerModel({ title: 'Implement a module', project: 'Other' })).toMatchObject({
		rung: { id: 'sol', effort: 'medium' },
		reason: 'feature/small: sol'
	});
	for (const item of [
		{ title: 'QA walkthrough for checkout' },
		{ title: 'Screen recording of the real app', model: 'sol:high' },
		{ title: 'Retest checkout', notes: 'Then record a short video of the real app.' },
		{ title: 'Fix tutor quiz cards. Then a 1-2 min captioned demo video.' },
		{ title: 'BuildFlexity QA video re-record for staging' }
	]) {
		expect.soft(pickTrackerModel(item), item.title).toMatchObject({
			rung: sonnet,
			reason: 'media deliverable requires Claude Sonnet 5.5'
		});
	}
	for (const title of [
		'Fix the screen recording pipeline',
		'Model routing: video/media deliverable tasks (QA walkthroughs, screen recordings)',
		'QA video: remove the checklist fallback in the generator',
		'Design and build a QA video recorder'
	]) {
		expect.soft(pickTrackerModel({ title, model: 'sol:high' }), title).toMatchObject({
			rung: { id: 'sol', effort: 'high', pinned: true }
		});
	}
});

test('keeps explicit model and effort even when the automatic choice can run cheaper', () =>
	measureWorkload('function.agents-providers-pick-tracker-model', 'named-model-selection', () => {
		expect(
			pickTrackerModel(
				{ ...visualModule, model: 'opus:xhigh' },
				{
					history: { haiku: { ok: 25, fail: 0 } }
				}
			)
		).toMatchObject({
			rung: { id: 'opus', model: 'claude-opus-5-5', effort: 'xhigh', pinned: true },
			reason: 'named on the item (opus:xhigh)'
		});
		expect(
			pickTrackerModel({ title: 'Review the scheduler', project: 'Tracker', model: 'fable' })
		).toMatchObject({ rung: { id: 'fable', model: 'claude-fable-5-2', pinned: true } });
	}));

test('enforces the risk floor and reserves Haiku for Harness modules', () => {
	const risky = { ...visualModule, notes: 'Backfill the database' };
	expect(pickTrackerModel(risky).rung.id).toBe('sol');
	expect(pickTrackerModel({ ...risky, model: 'haiku' })).toMatchObject({
		rung: { id: 'sol', pinned: true },
		reason: 'named haiku, raised to Sol (database change)'
	});
	expect(pickTrackerModel({ ...risky, model: 'gpt-6-luna' })).toMatchObject({
		rung: { id: 'sol', pinned: true },
		reason: 'named gpt-6-luna, raised to Sol (database change)'
	});
	expect(pickTrackerModel({ title: 'Fix a label', model: 'haiku' }).reason).toContain(
		'Haiku is reserved for Harness module work'
	);
});

test('retains the large-work floor and exact learning thresholds', () => {
	const history = { haiku: { ok: 1, fail: 2 }, terra: { ok: 1, fail: 1 } };
	expect(pickTrackerModel(visualModule, { history }).reason).toBe(
		'triage/small: terra; haiku succeeded 33% on similar tasks'
	);
	expect(
		pickTrackerModel(visualModule, {
			history,
			cfg: { autolaunch: { learning: { minSamples: 2, upBelow: 0.6 } } }
		}).rung.id
	).toBe('sol');
	expect(
		pickTrackerModel(visualModule, {
			history: { haiku: { ok: 1, fail: 1 } }
		}).rung.id
	).toBe('haiku');
	expect(
		pickTrackerModel(
			{ ...visualModule, notes: 'x'.repeat(1_501) },
			{
				history: { haiku: { ok: 10, fail: 0 } }
			}
		)
	).toMatchObject({ rung: { id: 'sol', effort: 'xhigh' }, reason: 'triage/large: sol' });
});

test('retries a pin on its named effort and advances Sol effort to its ceiling', () => {
	for (const previous of [
		{ rung: 'sol', model: 'gpt-6.2-sol', effort: 'high', pinned: true },
		{ rung: 'sonnet', model: 'claude-sonnet-5-5', effort: 'medium' }
	]) {
		expect
			.soft(retryTrackerModel({ title: 'Record a QA walkthrough' }, previous))
			.toMatchObject(sonnet);
	}
	expect(
		retryTrackerModel(visualModule, {
			rung: 'opus',
			model: 'claude-opus-5-5',
			effort: 'xhigh',
			pinned: 1
		})
	).toMatchObject({ id: 'opus', effort: 'xhigh', pinned: true });
	expect(retryTrackerModel(visualModule, { rung: 'terra', model: 'gpt-6.1-terra' })).toMatchObject({
		id: 'sol',
		effort: 'low'
	});
	expect(
		retryTrackerModel(visualModule, {
			rung: 'sol',
			model: 'gpt-6.2-sol',
			effort: 'low'
		})
	).toMatchObject({ id: 'sol', effort: 'medium' });
	expect(
		retryTrackerModel(visualModule, {
			rung: 'sol',
			model: 'gpt-6.2-sol',
			effort: 'xhigh'
		})
	).toMatchObject({ id: 'sol', effort: 'xhigh' });
});
