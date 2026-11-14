import { expect, test } from 'vitest';
import { declaredExamples } from './support/unitExamples';

test('function.case exposes four helpers with three examples each', () => {
	const { helpers } = declaredExamples('function.case');
	expect(helpers).toHaveLength(4);
	for (const helper of helpers) expect(helper.examples).toHaveLength(3);
});

test('activity-reading exposes its three documentation examples without a gap', () => {
	const { documentation } = declaredExamples('reports.function.activity-reading');
	expect(documentation).toBeDefined();
	expect(documentation?.examples).toHaveLength(3);
	expect(documentation?.gap).toBeUndefined();
});
