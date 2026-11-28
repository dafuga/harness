import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { expect, test } from 'vitest';
import {
	isHeavyTestCommand,
	withMacHeavyTestLane
} from '../../../src/utils/execution-runtimes/withMacHeavyTestLane';
import { runCommand } from '../../support/cli';
import { withTempDir } from '../../support/temporary';

test('recognizes the standard suite commands without queuing routine type checks', () => {
	const commands = [
		['bun', 'scripts/run-checks.ts', '--part', 'desktop'],
		['sh', '-c', 'PROJECT_REPORTS_ASSET_STORAGE=local playwright test && bun run test:shell'],
		['sh', '-c', 'bun run --cwd packages/hub check && bun run --cwd packages/hub test:e2e'],
		['vitest', 'run', 'test/resources-cli.e2e.test.ts']
	];
	expect(commands.every(isHeavyTestCommand)).toBe(true);
	expect(isHeavyTestCommand(['sh', '-c', 'tsc --noEmit "$@"', '--'])).toBe(false);
});

test.skipIf(process.platform !== 'darwin')(
	'holds a new suite under high load and allows ordinary commands',
	() =>
		withTempDir('harness-test-load-', async (directory) => {
			let load = [15, 22];
			const host = { directory, cores: 10, load: () => load };
			const options = { enabled: true, signal: AbortSignal.timeout(100), env: {} };
			const run = async () => 'started';
			await expect(withMacHeavyTestLane(options, run, host)).rejects.toThrow();
			await expect(withMacHeavyTestLane({ ...options, enabled: false }, run, host)).resolves.toBe(
				'started'
			);
			load = [1, 1];
			const recheck = { ...options, signal: AbortSignal.timeout(100) };
			await expect(
				withMacHeavyTestLane(
					recheck,
					async (_env, beforeStart) => {
						load = [1, 16];
						await beforeStart();
					},
					host
				)
			).rejects.toThrow();
		})
);

const moduleUrl = new URL(
	'../../../src/utils/execution-runtimes/withMacHeavyTestLane.ts',
	import.meta.url
).href;

const worker = `
const { withMacHeavyTestLane } = await import(${JSON.stringify(moduleUrl)});
const { existsSync, writeFileSync } = await import('node:fs');
const { join } = await import('node:path');
const { LANE_FIXTURE: directory, LANE_WORKER: id } = process.env;
await withMacHeavyTestLane({ enabled: true, signal: AbortSignal.timeout(7000), env: {} }, async () => {
	writeFileSync(join(directory, id), '');
	while (!existsSync(join(directory, 'release-' + id))) await Bun.sleep(25);
}, { directory, cores: 10, load: () => [1, 1] });
`;

test.skipIf(process.platform !== 'darwin')(
	'queues the third process behind two account-wide locks',
	() =>
		withTempDir('harness-test-lanes-', async (directory) => {
			const launch = (id: string) =>
				runCommand(['bun', '-e', worker], process.cwd(), false, {
					LANE_FIXTURE: directory,
					LANE_WORKER: id
				});
			const active = [launch('first'), launch('second')];
			try {
				await waitForStart(directory, ['first', 'second']);
				active.push(launch('third'));
				await delay(300);
				expect(existsSync(join(directory, 'third'))).toBe(false);
				writeFileSync(join(directory, 'release-first'), '');
				await waitForStart(directory, ['third']);
				expect(existsSync(join(directory, 'release-second'))).toBe(false);
			} finally {
				for (const id of ['first', 'second', 'third'])
					writeFileSync(join(directory, 'release-' + id), '');
				for (const result of await Promise.all(active))
					expect(result.exitCode, result.stderr).toBe(0);
			}
		}),
	10000
);

async function waitForStart(directory: string, ids: string[]) {
	await expect
		.poll(() => ids.every((id) => existsSync(join(directory, id))), { timeout: 4000 })
		.toBe(true);
}
