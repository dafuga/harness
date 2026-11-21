import { expect, test } from 'vitest';
import {
	ladderFrom,
	parseTrackerModelSpec
} from '../../../src/utils/agents-providers/parseTrackerModelSpec';

test('preserves canonical model identities and allows only matching rung customizations', () => {
	const ladder = ladderFrom({
		autolaunch: {
			ladder: [
				{ id: 'sol', model: 'gpt-6.1-sol', effort: 'low' },
				{ id: 'terra', model: 'gpt-6.1-terra', effort: 'high', cli: 'claude' }
			]
		}
	});
	expect(ladder.map(({ id, model, cli, effort }) => [id, model, cli, effort])).toEqual([
		['haiku', 'claude-haiku-5-5', 'claude', 'high'],
		['terra', 'gpt-6.1-terra', 'codex', 'high'],
		['sol', 'gpt-6.2-sol', 'codex', 'medium']
	]);
});

test('resolves rung names, the Sol alias, and explicit provider models', () => {
	const ladder = ladderFrom();
	expect(parseTrackerModelSpec('Opus:xhigh', ladder, null)).toMatchObject({
		id: 'opus',
		model: 'claude-opus-5-5',
		effort: 'xhigh',
		pinned: true
	});
	expect(parseTrackerModelSpec('sol-xhigh', ladder, null)).toMatchObject({
		id: 'sol',
		model: 'gpt-6.2-sol',
		effort: 'xhigh',
		pinned: true
	});
	expect(parseTrackerModelSpec('gpt-example', ladder, null)).toEqual({
		id: 'gpt-example',
		model: 'gpt-example',
		cli: 'codex',
		effort: 'xhigh',
		price: null,
		pinned: true
	});
});

test('rejects invalid syntax, outdated Sol, invalid Sol effort, and unknown aliases', () => {
	const ladder = ladderFrom();
	expect(() => parseTrackerModelSpec('sol:high:extra', ladder, null)).toThrow(
		'expected model[:effort]'
	);
	expect(() => parseTrackerModelSpec('gpt-6.1-sol', ladder, null)).toThrow('use gpt-6.2-sol');
	expect(() => parseTrackerModelSpec('sol:max', ladder, null)).toThrow('Sol effort must be');
	expect(() => parseTrackerModelSpec('example', ladder, null)).toThrow('unknown model "example"');
});

test('uses the case-insensitive Fable project allowlist, including its default', () => {
	const ladder = ladderFrom();
	expect(parseTrackerModelSpec('fable:high', ladder, 'buildflexity')).toMatchObject({
		id: 'fable',
		model: 'claude-fable-5-2',
		effort: 'high',
		pinned: true
	});
	expect(() => parseTrackerModelSpec('fable', ladder, 'Harness')).toThrow(
		'Fable is only used for BuildFlexity items'
	);
	expect(
		parseTrackerModelSpec('fable', ladder, 'Harness', {
			autolaunch: { fableProjects: ['harness'] }
		})
	).toMatchObject({ id: 'fable' });
});
