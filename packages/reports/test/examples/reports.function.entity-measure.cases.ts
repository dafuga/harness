import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import * as measures from '../../src/utils/explorer-ui/entityMeasure';
import type { Cases } from './reports.function.entity-measure.test.types';

const base = { unitId: 'reports.function.entity-measure', evidence: 'examples-cases' };
export const save = (symbol: string, state: string, cases: Cases) =>
	recordExampleCases({ ...base, symbol, state, file: `${state}.json` }, cases);

test('A byte count reads as B, KB or MB by its magnitude and keeps its sign', () => {
	const counts = [800, -2400, 1_000, 999_999, 1_000_000, -3_400_000, 0];
	const texts = ['800 B', '-2.4 KB', '1 KB', '1000 KB', '1 MB', '-3.4 MB', '0 B'];
	const outputs = counts.map((count) => measures.byteSize(count));
	expect(outputs).toEqual(texts);
	const cases = counts.map((count, index) => ({
		name: `count ${count}`,
		input: { count },
		output: outputs[index]
	}));
	save('byteSize', 'byte-size-scales-and-keeps-sign', cases);
});
