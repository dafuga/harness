import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { ScaffoldDetail } from '../../src/templates/development-tooling/scaffoldDetailTypes';

const detail: ScaffoldDetail = {
	kind: 'component',
	summary: 'Creates a reusable interface component.',
	appOnly: true,
	contains: ['component.tsx', 'component.test.tsx'],
	exampleCommand: 'harness generate component Notice --group feedback'
};

test('Describes a scaffold detail', () => {
	expect(detail).toMatchObject({
		kind: 'component',
		appOnly: true,
		contains: ['component.tsx', 'component.test.tsx']
	});
	recordExampleCases(
		{
			unitId: 'template.scaffold-detail-types',
			symbol: 'ScaffoldDetail',
			state: 'describes-a-scaffold-detail',
			evidence: 'examples-cases',
			file: 'describes-a-scaffold-detail.json'
		},
		[
			{
				name: 'component scaffold details expose their summary and generated files',
				input: { kind: 'component', summary: 'Creates a reusable interface component.' },
				output: detail
			}
		]
	);
});
