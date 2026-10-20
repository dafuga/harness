import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { openE2eRun } from '../../packages/reports/src/utils/e2e-fixtures/e2eFixtures';
import { syntheticPng } from './syntheticPng';

/**
 * SYNTHETIC FIXTURE OWNER. A process that owns one browser-run directory as a Playwright run does:
 * it opens the run, seeds a stand-in history (a `meta.json` and PNG media named by their hash, as
 * the console seed names them, and a frozen build), and when told its tests finished it ends with
 * the real teardown module of the reports package. It starts no browser and no server.
 */
const teardown = resolve(
	import.meta.dirname,
	'../../packages/reports/tests/e2e/support/removeFixtures.ts'
);
const fixtures = openE2eRun();
const media = join(fixtures.console, 'data', 'media');
const picture = syntheticPng(2 + (process.pid % 7), 2);
mkdirSync(media, { recursive: true });
writeFileSync(join(media, `${createHash('sha256').update(picture).digest('hex')}.png`), picture);
const baseline = createHash('sha1').update(fixtures.root).digest('hex');
writeFileSync(join(fixtures.console, 'meta.json'), JSON.stringify({ commits: { baseline } }));
mkdirSync(fixtures.build, { recursive: true });
writeFileSync(join(fixtures.build, 'index.js'), '// SYNTHETIC frozen build\n');

let state = 'idle';
const say = (line: string) => process.stdout.write(`${line}\n`);
say(`ready ${JSON.stringify({ root: fixtures.root, build: fixtures.build })}`);
createInterface({ input: process.stdin }).on('line', (line) => {
	if (line === 'status') say(`status ${state}`);
	else if (line === 'finish' && state === 'idle') {
		// Its tests finished: the run ends as Playwright ends it, with its global teardown.
		state = 'pending';
		void import(teardown).then(async (loaded: { default: () => unknown }) => {
			await loaded.default();
			state = 'returned';
			say('returned');
		});
	}
});
