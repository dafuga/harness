import { test } from 'vitest';
import { scanComponent } from '../../src/services/development-tooling/source-index-service/scanComponent';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Scans component props and markup snippets', () => {
	const input =
		'<script lang="ts">let { label, disabled }: { label: string; disabled?: boolean } = $props();</script>{#snippet row(item: string)}<span>{item}</span>{/snippet}<button>{label}</button>';
	const result = scanComponent(input, 'Button');
	const output = {
		symbols: result.symbols.map((symbol) => ({
			name: symbol.name,
			kind: symbol.kind,
			inputs: symbol.inputs,
			output: symbol.output
		})),
		errors: result.errors
	};

	expect(output).toEqual({
		symbols: [
			{
				name: 'Button',
				kind: 'component',
				inputs: [
					{ name: 'Button.label', type: 'string', required: true },
					{
						name: 'Button.disabled',
						type: 'boolean',
						required: false,
						defaultKind: 'omitted'
					}
				],
				output: 'markup'
			},
			{
				name: 'Button.row',
				kind: 'snippet',
				inputs: [{ name: 'Button.row.item', type: 'string', required: true }],
				output: 'markup'
			}
		],
		errors: []
	});
	recordExampleCases(
		{
			unitId: 'function.scan-component',
			symbol: 'scanComponent',
			state: 'scans-component-props-and-markup-snippets',
			evidence: 'examples-cases',
			file: 'scans-component-props-and-markup-snippets.json'
		},
		[{ name: 'component declares required and optional props and a snippet', input, output }]
	);
});
