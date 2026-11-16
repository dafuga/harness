import { test } from 'vitest';
import pickerViteConfig from '../../src/configs/development-tooling/pickerViteConfig';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

test('Resolves the picker library build settings', () => {
	expect(pickerViteConfig.plugins).toBeDefined();
	expect(pickerViteConfig.build).toMatchObject({
		outDir: 'dist/picker',
		emptyOutDir: true,
		cssCodeSplit: false,
		lib: {
			entry: 'src/utils/agents-providers/providerPickerEntry.ts',
			formats: ['iife'],
			name: 'HarnessPicker',
			fileName: 'picker'
		}
	});
	recordExampleCases(
		{
			unitId: 'reports.config.picker-vite',
			symbol: 'pickerViteConfig',
			state: 'resolves-the-picker-library-build-settings',
			evidence: 'examples-cases',
			file: 'resolves-the-picker-library-build-settings.json'
		},
		[
			{
				name: 'picker config exposes library output settings and declares plugins',
				input: null,
				output: pickerViteConfig.build
			}
		]
	);
});
