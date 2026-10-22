import { expect, test } from 'vitest';
import {
	byteSize,
	notMeasured,
	type EntityMeasure
} from '../../../src/utils/explorer-ui/entityMeasure';
import { metricChanges } from '../../../src/utils/explorer-ui/metricChanges';

function profile({
	source,
	complexity,
	latency,
	memory,
	name = 'bun-reference'
}: {
	source: number;
	complexity: number;
	latency: number;
	memory: number;
	name?: string;
}): EntityMeasure {
	return {
		size: [
			{ label: 'Source size', value: byteSize(source), rawValue: source, unitOfMeasure: 'bytes' },
			{ label: 'Complexity', value: String(complexity), rawValue: complexity }
		],
		performance: [
			{
				workload: 'orders-page',
				metric: 'Warm latency per call',
				target: 'browser',
				profile: name,
				value: `${latency} ms`,
				rawValue: latency,
				unitOfMeasure: 'ms',
				tolerance: '—',
				over: false
			},
			{
				workload: 'orders-page',
				metric: 'Benchmark process peak RSS',
				target: 'browser',
				profile: name,
				value: byteSize(memory),
				rawValue: memory,
				unitOfMeasure: 'bytes',
				tolerance: '—',
				over: false
			}
		]
	};
}

test('shows before, after and signed changes for compact metrics', () => {
	const [source, complexity, latency, memory] = metricChanges(
		profile({ source: 1400, complexity: 7, latency: 14.2, memory: 3_000_000 }),
		profile({ source: 1200, complexity: 6, latency: 12.1, memory: 2_500_000 })
	);
	expect([source, complexity, latency, memory]).toEqual([
		{
			key: 'size:Source size:',
			label: 'Source size',
			before: '1.4 KB',
			after: '1.2 KB',
			change: '−200 B'
		},
		{ key: 'size:Complexity:', label: 'Complexity', before: '7', after: '6', change: '−1' },
		{
			key: 'performance:Latency',
			label: 'Latency',
			before: '14.2 ms',
			after: '12.1 ms',
			change: '−2.1 ms'
		},
		{
			key: 'performance:Memory',
			label: 'Memory',
			before: '3 MB',
			after: '2.5 MB',
			change: '−500 KB'
		}
	]);
});

test('does not compare timing from another profile', () => {
	const [latency, memory] = metricChanges(
		profile({ source: 1400, complexity: 7, latency: 14.2, memory: 3_000_000 }),
		profile({ source: 1200, complexity: 6, latency: 12.1, memory: 2_500_000, name: 'ci-linux' })
	).slice(-2);
	expect(latency.change).toBe('Profile changed');
	expect(latency.beforeContext).toBe('orders-page · browser · bun-reference');
	expect(latency.afterContext).toBe('orders-page · browser · ci-linux');
	expect(memory.change).toBe('Profile changed');
});

test('keeps workload, target and unit mismatches visible without inventing a delta', () => {
	const before = profile({ source: 1400, complexity: 7, latency: 14.2, memory: 3_000_000 });
	let after = profile({ source: 1200, complexity: 6, latency: 12.1, memory: 2_500_000 });
	after.performance[0].workload = 'other-orders';
	expect(metricChanges(before, after)[2]).toMatchObject({
		before: '14.2 ms',
		after: '12.1 ms',
		change: 'Workload changed'
	});
	after = profile({ source: 1200, complexity: 6, latency: 12.1, memory: 2_500_000 });
	after.performance[0].target = 'server';
	expect(metricChanges(before, after)[2].change).toBe('Target changed');
	after = profile({ source: 1200, complexity: 6, latency: 12.1, memory: 2_500_000 });
	after.performance[0].unitOfMeasure = 's';
	after.performance[0].value = '0.0121 s';
	after.performance[0].rawValue = 0.0121;
	expect(metricChanges(before, after)[2].change).toBe('Unit changed');
});

test('keeps missing measurements visible without treating them as zero', () => {
	const before = profile({ source: 1400, complexity: 7, latency: 14.2, memory: 3_000_000 });
	before.performance[0] = {
		...before.performance[0],
		value: notMeasured,
		rawValue: null
	};
	const latency = metricChanges(
		before,
		profile({ source: 1200, complexity: 6, latency: 12.1, memory: 2_500_000 })
	)[2];
	expect(latency).toMatchObject({
		before: notMeasured,
		after: '12.1 ms',
		change: 'Not comparable'
	});
});
