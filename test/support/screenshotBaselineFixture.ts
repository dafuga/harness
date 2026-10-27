import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { runCommand } from './cli';
import { fixtureScenario, fixtureUnit } from './screenshotBaselineContracts';
import { attachSyntheticScreenshot } from './screenshotBaselineRecord';
import type { ScreenshotFixtureOptions } from './screenshotBaselineFixture.types';

/** A disposable synthetic record exercises storage only; it is never browser or release proof. */
export async function screenshotBaselineFixture(options: ScreenshotFixtureOptions = {}) {
	const root = await mkdtemp(join(tmpdir(), 'harness-baseline-'));
	const git = (args: string[]) => fixtureGit(root, args);
	const write = async (path: string, bytes: string) => {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), bytes);
	};
	try {
		await git(['init', '-q', '-b', 'main']);
		await write('src/routes/fixture/+page.svelte', '<h1>Fixture</h1>\n');
		await write('test/page.spec.ts', '// Synthetic case identity for repository unit testing.\n');
		await write('specification/units/page.fixture.json', JSON.stringify(fixtureUnit(options)));
		await write('specification/scenarios/visual.json', JSON.stringify(fixtureScenario(options)));
		await git(['add', '-A']);
		await git(['commit', '-q', '-m', 'feat: fixture']);
		const commit = await git(['rev-parse', 'HEAD']);
		const tree = await git(['rev-parse', 'HEAD^{tree}']);
		const { record, image, sha256 } = await attachSyntheticScreenshot(root, commit, tree, options);
		const input = {
			commit,
			record: record.id,
			unit: 'page.fixture',
			case: 'default.desktop',
			scenario: 'visual',
			evidence: 'screens',
			viewport: 'desktop',
			reviewer: 'Fixture reviewer',
			reason: 'Inspected synthetic pixels in a disposable test.'
		};
		return {
			root,
			input,
			image,
			sha256,
			dispose: () => rm(root, { recursive: true, force: true })
		};
	} catch (error) {
		await rm(root, { recursive: true, force: true });
		throw error;
	}
}

async function fixtureGit(root: string, args: string[]): Promise<string> {
	const identity = [
		'-c',
		'user.name=Fixture',
		'-c',
		'user.email=fixture@harness.invalid',
		'-c',
		'commit.gpgsign=false'
	];
	return (await runCommand(['git', ...identity, ...args], root)).stdout.trim();
}
