/**
 * Gives the browser run this process belongs to its own copy of the finished build, and prints
 * where it is. The run's built servers are started from that copy, never from the build
 * directory of the checkout, which another build may replace at any time.
 */
import { resolve } from 'node:path';
import { e2eFixtures } from '../src/utils/development-tooling/e2e-fixtures/e2eFixtures';
import { frozenBuild } from '../src/utils/development-tooling/frozenBuild';

const source = resolve(process.argv[2] ?? 'build');
try {
	console.log(JSON.stringify(await frozenBuild(source, e2eFixtures().build)));
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
