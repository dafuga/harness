import { expect, test } from 'vitest';
import { measureWorkload } from '../../support/measureWorkload';
import {
	classifyTrackerTask,
	floorReasons,
	isHarnessModule,
	isVisualInspection,
	projectOf,
	sizeOf,
	solEffort
} from '../../../src/utils/agents-providers/classifyTrackerTask';

test('classifies the title first and uses notes when the title has no match', () => {
	expect(classifyTrackerTask({ title: 'Fix layout', notes: 'Review deadlocks' })).toBe('bugfix');
	expect(classifyTrackerTask({ title: 'Map the result', notes: 'Review deadlocks' })).toBe('hard');
	expect(classifyTrackerTask({ title: 'Make a map' })).toBe('feature');
});

test('applies length and bullet thresholds to the entire brief', () => {
	expect(sizeOf({ title: 'x'.repeat(198) })).toBe('small');
	expect(sizeOf({ title: 'x'.repeat(199) })).toBe('medium');
	expect(sizeOf({ notes: '- item\n'.repeat(8) })).toBe('large');
	expect(sizeOf({ notes: 'x'.repeat(1_500) })).toBe('large');
});

test('returns all applicable floor reasons in Tracker order', () => {
	expect(
		floorReasons({
			title: 'Merge the PR',
			notes: 'Backfill the database and verify the Stripe credentials',
			project: 'Production',
			sensitive: 1
		})
	).toEqual([
		'marked sensitive',
		'sensitive (secrets, payments, production/infra)',
		'database change',
		'GitHub promotion'
	]);
	expect(floorReasons({ title: 'Review the layout' })).toEqual([]);
});

test('uses the agent as the project fallback and checks the visual title', () => {
	expect(projectOf({ project: 'Other', agent: 'Harness' })).toBe('Other');
	expect(isHarnessModule({ agent: 'Harness', notes: 'A module' })).toBe(true);
	expect(isHarnessModule({ agent: 'Harness', title: 'Fix a label' })).toBe(false);
	expect(isVisualInspection({ title: 'Compare screenshots' })).toBe(true);
	expect(isVisualInspection({ title: 'Generate a mockup', notes: 'Review it' })).toBe(false);
});

test('uses medium for routine work and high for hard work', () =>
	measureWorkload('function.agents-providers-classify-tracker-task', 'sol-effort-by-task', () => {
		expect(solEffort('docs', 'small')).toBe('medium');
		expect(solEffort('feature', 'small')).toBe('medium');
		expect(solEffort('refactor', 'small')).toBe('medium');
		expect(solEffort('bugfix', 'medium')).toBe('medium');
		expect(solEffort('ops', 'small')).toBe('medium');
		expect(solEffort('docs', 'large')).toBe('medium');
		expect(solEffort('hard', 'small')).toBe('high');
	}));
