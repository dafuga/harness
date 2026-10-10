import { expect, test } from 'vitest';
import { comparisonContext } from '../../src/utils/comparisonContext';
import { comparisonDifferences } from '../../src/utils/comparisonDifferences';

const comparison = comparisonContext({ operation: 'rank' }, { rounds: 5, iterations: 30 });
const definition = { unitOfMeasure: 'ms', method: 'Fastest call.', comparison };

test('identical definitions are comparable', () => {
	expect(comparisonDifferences('latency-floor-ms', definition, { ...definition })).toEqual({
		status: 'comparable',
		differences: []
	});
});

test('missing metadata is incomplete before any difference is considered', () => {
	const bare = comparisonDifferences('latency-floor-ms', { unitOfMeasure: 'seconds' }, {});
	expect(bare.status).toBe('incomplete');
	expect(bare.differences).toEqual([
		'the measurement states no comparison context',
		'the measurement states no method',
		'the baseline states no comparison context',
		'the baseline states no unit of measure',
		'the baseline states no method'
	]);
	const invalid = { ...definition, comparison: { ...comparison, sampling: { rounds: 5 } } };
	expect(comparisonDifferences('latency-floor-ms', invalid, definition)).toEqual({
		status: 'incomplete',
		differences: ['the measurement states an invalid comparison context']
	});
});

test('every difference is named, in a fixed order', () => {
	const other = {
		unitOfMeasure: 'seconds',
		method: 'Timed an inner helper.',
		comparison: {
			request: 'f'.repeat(64),
			boundary: 'fixture',
			protocol: 'other/1',
			sampling: { warmup: 0, rounds: 1, iterations: 1 }
		}
	};
	const verdict = comparisonDifferences('latency-floor-ms', other, definition);
	expect(verdict.status).toBe('incompatible');
	expect(verdict.differences.map((text) => text.split(' ')[0])).toEqual([
		'unit',
		'request',
		'measured',
		'protocol',
		'sampling',
		'method'
	]);
	const custom = { ...definition, unitOfMeasure: 'points' };
	expect(comparisonDifferences('custom-score', custom, custom).status).toBe('comparable');
});
