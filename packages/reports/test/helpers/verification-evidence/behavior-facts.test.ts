import { expect, test } from 'vitest';
import { behaviorFacts } from '../../../src/helpers/verification-evidence/behaviorFacts';
import type { BehaviorScenario } from '../../../src/helpers/verification-evidence/behaviorFacts.types';
import { measureWorkload } from '../../../../../test/support/measureWorkload';

test('behaviorFacts preserves scenario order, missing outcomes and caller-owned array access', async () => {
	await measureWorkload(
		'reports.helper.verification-evidence-behavior-facts',
		'paired-scenario-facts',
		() => {
			const visits: string[] = [];
			class Scenarios extends Array<BehaviorScenario> {
				static get [Symbol.species](): ArrayConstructor {
					throw new Error('Species must not be read');
				}
			}
			const scenarios = new Scenarios({
				id: 'checkout',
				title: 'Approve invoice',
				get before() {
					visits.push('before');
					return null;
				},
				get after() {
					visits.push('after');
					return 'failed';
				}
			});
			Object.defineProperty(scenarios, Symbol.iterator, {
				value: () => {
					throw new Error('Iterator must not be read');
				}
			});
			const rows = behaviorFacts('Not measured', scenarios, true, { highlight: true });
			expect(rows).toEqual([
				{ key: 'duration', label: 'E2E duration', value: 'Not measured', className: 'unmeasured' },
				{
					key: 'checkout',
					label: 'Approve invoice',
					value: 'not run → failed',
					className: 'failed'
				}
			]);
			expect(visits).toEqual(['after', 'before', 'after']);
			visits.length = 0;
			expect(
				behaviorFacts(null, scenarios, false, { durationLabel: 'End-to-end duration' })[1].value
			).toBe('failed');
			expect(visits).toEqual(['after']);
			expect(behaviorFacts('0 ms', [], false)[0].value).toBe('0 ms');
		}
	);
});
