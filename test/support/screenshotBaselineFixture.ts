import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect } from 'vitest';
import { runCommand } from './cli';
import { fixtureScenario, fixtureUnit } from './screenshotBaselineContracts';
import { attachSyntheticScreenshot } from './screenshotBaselineRecord';
import type { ScreenshotFixtureOptions } from './screenshotBaselineFixture.types';
import { ScreenshotBaselineService } from '../../src/services/verification-evidence/ScreenshotBaselineService';

/** Both attempts remain in evidence; the reviewed bytes belong to the selected retry. */
export async function assertRetriedReview(): Promise<void> {
	const fixture = await screenshotBaselineFixture({ attempts: 'bound' });
	try {
		const service = new ScreenshotBaselineService(fixture.root);
		const review = await service.review(fixture.input);
		expect(review).toMatchObject({ caseStatus: 'passed', captureRetry: 1, recordStatus: 'failed' });
		expect(review.capturePath).toContain('/retry-1.png');
		const { id, unit, viewport, file } = review;
		expect((await service.load({ id, unit, viewport, file, case: review.case })).bytes).toEqual(
			fixture.image
		);
		expect(
			fixture.record.tests[0].cases?.outcomes.map(({ status, retry }) => ({ status, retry }))
		).toEqual([
			{ status: 'failed', retry: 0 },
			{ status: 'passed', retry: 1 }
		]);
		expect(fixture.record.scenarios[0].states[0].captures).toHaveLength(2);
	} finally {
		await fixture.dispose();
	}
}

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
			record,
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
