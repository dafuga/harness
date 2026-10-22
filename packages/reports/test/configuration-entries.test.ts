import { expect, test } from 'vitest';
import { resolve } from 'node:path';
import { measureProcess } from '../../../test/support/cli-measurement/measureHarness';
import { runCommand } from '../../../test/support/cli';

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
