import { measureWorkload } from '../../../../test/support/measureWorkload';
import { render } from 'svelte/server';
import { expect } from 'vitest';
import EntitySummary from '../../src/components/explorer-ui/EntitySummary.svelte';
import type { EntityMeasure } from '../../src/utils/explorer-ui/entityMeasure.types';
import { words } from '../entityRender';

/** Characterize compact profile reads without changing the overview scenario count. */
export async function assertCompactSummaryAdmission() {
	const measure = compactMeasure();
	for (const array of [measure.size, measure.performance]) {
		Object.defineProperty(array, Symbol.iterator, {
			value: () => {
				throw new Error('Unexpected iterator');
			}
		});
		Object.defineProperty(array, 'constructor', {
			value: {
				get [Symbol.species]() {
					throw new Error('Unexpected species');
				}
			}
		});
	}
	const summary = () => render(EntitySummary, { props: { measure, compact: true } }).body;
	await measureWorkload(
		'reports.function.explorer-ui-entity-summary-facts',
		'compact-profile-facts',
		() => expect(words(summary())).toContain('Source size 810 B Latency 2 ms Memory Not measured')
	);
	Object.defineProperty(measure.size[0], 'value', {
		get() {
			return '920 B';
		}
	});
	expect(words(summary())).toContain('Source size 920 B');
	const error = new Error('Unreadable measurement');
	Object.defineProperty(measure.performance[0], 'metric', {
		get() {
			throw error;
		}
	});
	expect(summary).toThrow(error);
}

function compactMeasure() {
	return {
		size: [{ label: 'Source size', value: '810 B' }],
		performance: [
			{
				workload: 'Approve invoice',
				metric: 'latency',
				target: 'browser',
				profile: 'desktop',
				value: '2 ms',
				tolerance: '5%',
				over: false
			}
		]
	} satisfies EntityMeasure;
}
