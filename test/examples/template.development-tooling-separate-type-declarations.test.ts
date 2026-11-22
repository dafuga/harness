import { test } from 'vitest';
import { separateTypeDeclarations } from '../../src/templates/development-tooling/separateTypeDeclarations';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Splits generated type declarations beside the implementation', () => {
	const input = [
		{
			path: 'src/feature.ts',
			contents:
				'export interface FeatureOptions { enabled: boolean; }\n\nexport function createFeature(options: FeatureOptions) { return options.enabled; }\n'
		}
	];
	const output = separateTypeDeclarations(input);
	expect(output).toEqual([
		{
			path: 'src/feature.ts',
			contents:
				"import type { FeatureOptions } from './feature.types';\n\nexport function createFeature(options: FeatureOptions) { return options.enabled; }\n\nexport type { FeatureOptions } from './feature.types';\n"
		},
		{
			path: 'src/feature.types.ts',
			contents: 'export interface FeatureOptions { enabled: boolean; }\n'
		}
	]);
	recordExampleCases(
		{
			unitId: 'template.development-tooling-separate-type-declarations',
			symbol: 'separateTypeDeclarations',
			state: 'splits-generated-type-declarations-beside-the-implementation',
			evidence: 'examples-cases',
			file: 'splits-generated-type-declarations-beside-the-implementation.json'
		},
		[{ name: 'splits a feature interface from its implementation', input, output }]
	);
});
