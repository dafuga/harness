import { expect, test } from 'vitest';
import { resolve } from 'node:path';
import { measureProcess } from '../../../test/support/cli-measurement/measureHarness';
import { runCommand } from '../../../test/support/cli';

test.each(['src/config/shellViteConfig.ts', 'src/config/development-tooling/shellViteConfig.ts'])(
	'the %s component fixture aliases resolve to actual source owners',
	async (entry) => {
		const program = `import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
const {default: configure} = await import(${JSON.stringify(resolve(entry))});
const config = await configure({command: 'build', mode: 'test'});
const expected = {
  '$app/navigation': 'tests/e2e/support/component-previews/router.svelte.ts',
  '$app/state': 'tests/e2e/support/component-previews/router.svelte.ts',
  '$desktop': '../desktop/src',
  '$shared': 'src/components',
  '$app/paths': 'tests/e2e/support/shell/hubPaths.ts'
};
for (const [alias, path] of Object.entries(expected)) {
  assert.equal(config.resolve.alias[alias], resolve(path), alias);
  assert.ok(existsSync(config.resolve.alias[alias]), alias + ' must exist');
}
console.log(JSON.stringify({aliases: Object.keys(expected).length}));`;
		const result = await measureProcess(
			{
				units: ['reports.config.shell-vite'],
				workload: 'cold-component-fixture-config-alias-resolution',
				target: 'module',
				command: ['bun', '--eval', program],
				cwd: process.cwd(),
				env: { SHELL_FIXTURE_PAGE: 'components', HARNESS_RUNTIME_PROFILE_BOUNDARY: 'benchmark' },
				partial:
					'Actual configuration evaluation and alias validation; bundling and browser rendering are measured by their registered scenarios.'
			},
			runCommand
		);
		expect(JSON.parse(result.stdout)).toEqual({ aliases: 5 });
	}
);

/** Each data configuration initializes in its own fresh runtime; no bundler cost is inferred. */
test.each([
	['report', 'viewer', 'src/lib/portable.ts'],
	['console', 'console', 'src/lib/console.ts'],
	['picker', 'picker', 'src/utils/providerPickerEntry.ts']
])(
	'the %s build configuration declares its real output and public entry',
	async (name, output, entry) => {
		const source = resolve(`src/config/${name}ViteConfig.ts`);
		const program = `import assert from 'node:assert/strict';
const {default: config} = await import(${JSON.stringify(source)});
assert.equal(config.build.outDir, ${JSON.stringify('dist/' + output)});
assert.equal(config.build.lib.entry, ${JSON.stringify(entry)});
assert.ok(config.plugins.length > 0);
console.log(JSON.stringify({output: config.build.outDir, entry: config.build.lib.entry}));`;
		const result = await measureProcess(
			{
				units: [`reports.config.${name}-vite`],
				workload: 'cold-build-configuration-initialization',
				target: 'module',
				command: ['bun', '--eval', program],
				cwd: process.cwd(),
				env: { HARNESS_RUNTIME_PROFILE_BOUNDARY: 'benchmark' },
				partial:
					'Configuration initialization and declared entry assertions only; actual bundling is verified by the normal build, without attributing its time to this import.'
			},
			runCommand
		);
		expect(JSON.parse(result.stdout)).toEqual({ output: 'dist/' + output, entry });
	}
);

test.each(['picker', 'shell'])(
	'the %s browser configuration initializes without starting its declared server',
	async (name) => {
		const source = resolve(`src/config/${name}PlaywrightConfig.ts`);
		const program = `import assert from 'node:assert/strict';
const {default: config} = await import(${JSON.stringify(source)});
assert.equal(config.workers, 1);
assert.equal(config.testDir, '../../tests/e2e');
assert.ok(config.testMatch);
console.log(JSON.stringify({workers: config.workers, directory: config.testDir}));`;
		const result = await measureProcess(
			{
				units: [`reports.config.${name}-playwright`],
				workload: 'cold-browser-configuration-initialization',
				target: 'module',
				command: ['bun', '--eval', program],
				cwd: process.cwd(),
				env: { HARNESS_RUNTIME_PROFILE_BOUNDARY: 'benchmark' },
				partial:
					'Configuration initialization only; the actual registered browser matrix starts its own server and measures the rendered pages separately.'
			},
			runCommand
		);
		expect(JSON.parse(result.stdout)).toEqual({ workers: 1, directory: '../../tests/e2e' });
	}
);
