import { expect, test } from 'vitest';
import { ladderFrom } from '../../../src/utils/agents-providers/parseTrackerModelSpec';
import { pickTrackerModel } from '../../../src/utils/agents-providers/pickTrackerModel';
import { redirectTrackerRung } from '../../../src/utils/agents-providers/redirectTrackerRung';
import { retryTrackerModel } from '../../../src/utils/agents-providers/retryTrackerModel';
import { escalationRungs } from '../../../src/utils/agents-providers/trackerEscalation';
import { trackerTaskType } from '../../../src/utils/agents-providers/trackerTaskType';

const now = Date.parse('2026-11-28T20:00:00Z');
const on = { now, claudePreferredUntil: '2026-11-29T21:00:00Z' };
const off = { now };
const opus = { rung: 'opus', model: 'claude-opus-5-5', effort: 'high' };
const failedOpus = { model: opus.model, effort: opus.effort };
const struggled = { failed: [failedOpus, failedOpus], incidents: [] };
const chosen = (title: string, options: Parameters<typeof pickTrackerModel>[1] = on) => {
	const { rung, taskType } = pickTrackerModel({ title }, options);
	return `${taskType} ${rung.model}:${rung.effort}`;
};

test('infers the task type from the title, and --kind overrides it', () => {
	for (const [title, type] of [
		['Coordinate the release push across both Macs', 'coordinator'],
		['Chief of Staff: run the evening status ticks', 'coordinator'],
		['Orchestrator: run the Hub module sessions', 'coordinator'],
		['Write the module contracts for the parser', 'coordinator'],
		['Design mockups for the Hub home', 'design'],
		['Hub: wireframes for the plan view', 'design'],
		['Design review of the new needs-you cards', 'design'],
		['Redesign the dashboard page', 'design'],
		['Deploy to preprod', 'deploy'],
		['Open the dashboard in Chrome', 'computer-use'],
		['Fix a race condition in the queue', 'hard'],
		['Update the README', 'simple'],
		['Add CSV export to the report', 'default']
	])
		expect(trackerTaskType({ title }), title).toBe(type);
	expect(trackerTaskType({ title: 'Add CSV export', task_type: 'coordinator' })).toBe(
		'coordinator'
	);
	expect(
		trackerTaskType({ title: 'Capacity push', brief: 'BRIEF: You are the launch orchestrator.' })
	).toBe('coordinator');
});

test('a passing mention never selects the coordinator or design route', () => {
	for (const title of [
		'Tracker: Chief of Staff watchdog push is stuck',
		'Tracker: pick the model by task type: coordinator -> Opus; design -> Fable',
		'Fix the smart contract coordinator race',
		'Polish the dashboard layout',
		'Fix mockup upload',
		'Design: database schema for reminders',
		'Review the API design notes'
	])
		expect(['coordinator', 'design'], title).not.toContain(trackerTaskType({ title }));
});

test('coordinator, design and deploy keep their routes with and without the preference', () => {
	for (const options of [on, off]) {
		expect(chosen('Coordinate the release push', options)).toBe('coordinator claude-opus-5-5:high');
		expect(chosen('Design mockups for the Hub', options)).toBe('design claude-fable-5-2:high');
		expect(chosen('Deploy to preprod', options)).toBe('deploy claude-sonnet-5-5:high');
		expect(chosen('Deploy BuildFlexity to production', options)).toBe(
			'deploy claude-opus-5-5:high'
		);
	}
});

test('everything else starts on the cheapest rung and climbs one per failed attempt', () => {
	const item = { title: 'Add CSV export' };
	const failures = [
		['claude-sonnet-5-5', 'medium'],
		['claude-sonnet-5-5', 'high']
	].map(([model, effort]) => ({ model, effort }));
	const at = (count: number) =>
		pickTrackerModel(item, {
			...on,
			evidence: { failed: failures.slice(0, count), incidents: [] }
		}).rung;
	expect([at(0), at(1), at(2)].map(({ id, effort }) => `${id} ${effort}`)).toEqual([
		'sonnet medium',
		'sonnet high',
		'opus high'
	]);
	const simple = { title: 'Update the README' };
	const low = { rung: 'sonnet', model: 'claude-sonnet-5-5', effort: 'low' };
	expect(retryTrackerModel(simple, low, on)).toMatchObject({ id: 'sonnet', effort: 'medium' });
	expect(
		pickTrackerModel(item, {
			...off,
			evidence: { failed: [{ model: 'gpt-6.2-sol', effort: 'medium' }], incidents: [] }
		}).rung
	).toMatchObject({ id: 'sol', effort: 'high' });
});

test('two failed Opus attempts send hard work to Fable, then Astra', () => {
	const item = { title: 'Coordinate the release push' };
	const once = { failed: [failedOpus], incidents: [] };
	expect(pickTrackerModel(item, { ...off, evidence: once }).rung.id).toBe('opus');
	expect(pickTrackerModel(item, { ...off, evidence: struggled }).rung).toMatchObject({
		model: 'claude-fable-5-2',
		effort: 'high'
	});
	expect(retryTrackerModel(item, opus, { ...off, evidence: struggled }).id).toBe('fable');
	const fable = { model: 'claude-fable-5-2', effort: 'high' };
	const both = { failed: [...struggled.failed, fable], incidents: [] };
	expect(pickTrackerModel(item, { ...off, evidence: both }).rung).toMatchObject({
		model: 'gpt-6.2-astra',
		effort: 'high',
		cli: 'codex'
	});
	// Claude only: Astra waits until the preference ends.
	expect(pickTrackerModel(item, { ...on, evidence: both }).rung.id).toBe('fable');
});

test('one model-quality incident on Opus escalates, and Astra is never a first choice', () => {
	const item = { title: 'Fix a race condition' };
	const evidence = { failed: [], incidents: ['claude-opus-5-5:high'] };
	expect(pickTrackerModel(item, { ...on, evidence }).rung.id).toBe('fable');
	for (const title of ['Add CSV export', 'Fix a race condition', 'Update the README'])
		for (const options of [on, off])
			expect(pickTrackerModel({ title }, options).rung.model, title).not.toContain('astra');
	const cfg = { autolaunch: { taskRoutes: { default: ['gpt-6.2-astra:high', 'sonnet:low'] } } };
	expect(chosen('Add CSV export', { ...off, cfg })).toBe('default claude-sonnet-5-5:low');
});

test('the task-type table can be changed by the Tracker routing setting', () => {
	const cfg = { autolaunch: { taskRoutes: { simple: ['haiku:low', 'sonnet:low'] } } };
	expect(chosen('Update the README', { ...on, cfg })).toBe('simple claude-haiku-5-5:low');
});

test('Gemini joins only when enabled and a launch adapter exists', () => {
	const ladder = ladderFrom();
	const cfg = { autolaunch: { gemini: { enabled: true } } };
	const carbon = () => ({
		id: 'gemini',
		cli: 'codex' as const,
		model: 'synthetic-gemini',
		effort: 'high',
		price: null
	});
	const ids = (...args: Parameters<typeof escalationRungs>) =>
		escalationRungs(...args).map(({ id }) => id);
	expect(ids(ladder, cfg)).toEqual(['fable', 'astra']);
	expect(ids(ladder, undefined, carbon)).toEqual(['fable', 'astra']);
	expect(ids(ladder, cfg, carbon)).toEqual(['fable', 'astra', 'gemini']);
});

test('an explicit --model beats the preference, the floor, climbing and escalation', () => {
	for (const [title, model] of [
		['Add CSV export', 'gpt-6.1-terra:medium'],
		['Fix a billing bug', 'haiku'],
		['Coordinate the release push', 'gpt-6.2-sol:high']
	]) {
		const item = { title, model, explicit_model: model };
		const options = { ...on, evidence: struggled };
		const picked = pickTrackerModel(item, options);
		expect(picked.reason).toContain('explicit --model wins');
		expect(picked.rung.pinned).toBe(true);
		expect(retryTrackerModel(item, opus, options)).toEqual(picked.rung);
		const same = { cli: picked.rung.cli, model: picked.rung.model, effort: picked.rung.effort };
		expect(redirectTrackerRung(item, same, options)).toBeNull();
		expect(redirectTrackerRung(item, { cli: 'claude', model: 'x' }, options)?.rung).toEqual(
			picked.rung
		);
	}
});

test('a model saved without --model still follows the Claude preference', () => {
	const item = { title: 'Add CSV export', model: 'gpt-6.2-sol', explicit_model: 'opus' };
	expect(pickTrackerModel(item, on).rung.cli).toBe('claude');
});
