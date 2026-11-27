import { expect, test } from 'vitest';
import { PlanningError, fail, parse } from '../src/utils/planning-collaboration/planData';

test('fail throws a PlanningError that keeps its message, code and null path', () => {
	let thrown: unknown;
	try {
		fail('artifact-corrupt', 'Invalid artifact JSON');
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBeInstanceOf(PlanningError);
	expect(thrown).toBeInstanceOf(Error);
	expect(thrown).toMatchObject({
		name: 'Error',
		message: 'Invalid artifact JSON',
		code: 'artifact-corrupt',
		path: null
	});
});

test('parse reports malformed bytes as an artifact-corrupt PlanningError', () => {
	expect(() => parse(new TextEncoder().encode('{'))).toThrow(PlanningError);
});
