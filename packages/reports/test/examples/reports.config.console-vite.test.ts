import { test } from 'vitest';
import consoleViteConfig from '../../src/configs/development-tooling/consoleViteConfig';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const state = 'resolves-console-library-build-settings';
const resolvedSettings = {
	pluginCount: consoleViteConfig.plugins?.length,
	outDir: consoleViteConfig.build?.outDir,
	emptyOutDir: consoleViteConfig.build?.emptyOutDir,
	cssCodeSplit: consoleViteConfig.build?.cssCodeSplit,
	lib: consoleViteConfig.build?.lib
};

test('Resolves console library build settings', () => {
	expect(resolvedSettings).toEqual({
	pluginCount: 1,
	outDir: 'dist/console',
	emptyOutDir: true,
	cssCodeSplit: false,
	lib: {
		entry: 'src/lib/development-tooling/console.ts',
		formats: ['iife'],
		name: 'HarnessConsole',
		fileName: 'console'
	}
	});
	recordExampleCases(
		{
			unitId: 'reports.config.console-vite',
			symbol: 'default',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'default Vite config sets the single-script console library build',
				input: null,
				output: resolvedSettings
			}
		]
	);
});
