import { expect, test } from 'vitest';
import type { VerificationRecord } from '../../src/core/verificationTypes';
import { unitGrowth } from '../../src/services/history-index-service/historySeries';

const commit = 'a'.repeat(40);
const reason = 'Decision points are not counted in Rust: crates/counter/src/lib.rs.';

test('growth keeps a metric without a value absent and carries why', () => {
	const measured = (metric: string, value: number | null, extra: object = {}) => ({
		unit: 'kernel.counter',
		metric,
		value,
		testedRevision: commit,
		...extra
	});
	const record = {
		id: 'r1',
		measurements: [
			measured('source-bytes', 10),
			measured('complexity', null, { unavailable: reason }),
			measured('dependencies', 1, { partial: 'one manifest was not read' })
		]
	} as unknown as VerificationRecord;
	expect(unitGrowth([record])).toEqual([
		{
			id: 'kernel.counter',
			growth: [
				{
					commit,
					record: 'r1',
					'source-bytes': 10,
					dependencies: 1,
					notes: { complexity: reason, dependencies: 'one manifest was not read' }
				}
			]
		}
	]);
});
