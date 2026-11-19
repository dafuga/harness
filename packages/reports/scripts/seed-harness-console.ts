// @harness-uid u_so5sz7vzkk
/**
 * Builds the fixed synthetic history the /harness browser acceptance inspects: a throwaway Git
 * repository with a shared function, a service, a page scenario at three viewports and an audio
 * scenario, verified commit by commit through the real CLI. Nothing here touches this
 * repository's own refs. The audio is a generated tone and its transcript says so.
 *
 * Importing this module has no effect. The seeding runs only when it is started as a script.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { legacyRun } from '../../../test/support/legacyStore';
import { e2eFixtures } from '../src/utils/development-tooling/e2e-fixtures/e2eFixtures';
import { explorerBranch, explorerUnits } from './harness-explorer-seed';
import { writeScaleData } from './harness-scale-data';
import { seedShells } from './harness-shells-seed';
import type { ConsoleSeed } from '../test/support/harnessConsoleFixture.types';
import {
	explain,
	keptBranch,
	openConsoleSeed,
	seedGrownSlugify,
	seedKeptAndRetained,
	seedLoaderUnit,
	seedNativeCounters,
	seedShoutChange,
	seedTitlesPage
} from '../test/support/harnessConsoleFixture';

/** Phase 8: a reordered change verified under several environments and argument sets. */
async function seedVerificationRuns(seed: ConsoleSeed) {
	const { repo, commits, verified } = seed;
	commits.reordered = await repo.change('src/utils/slugify.ts', (source) =>
		source.replace(/input\.trim\(\)\.(to\w+Case)\(\)/, 'input.$1().trim()')
	);
	await verified(repo, { FIXTURE_SKIP: 'filled-mobile' });
	await verified(repo, { FIXTURE_STALE_REVISION: commits.baseline });
	await verified(repo);
	await verified(repo, { HARNESS_PROFILE_LABEL: 'another-runner' }, ['--base', 'none']);
}

/**
 * Phase 9: two failed attempts whose captures must never read as tested, an unverified commit and
 * a source edit that has no record. Its impact still has to be shown from the source alone.
 */
async function seedUnverifiedStates(seed: ConsoleSeed) {
	const { repo, commits, verified } = seed;
	commits.restated = await repo.change('src/utils/slugify.ts', (source) =>
		source.replace(
			"input.length > 99 || input.includes('?')",
			"input.includes('?') || input.length > 99"
		)
	);
	await verified(repo, { FIXTURE_NO_STAMP: '1' });
	await verified(repo, { FIXTURE_NO_TRANSCRIPT: '1' });

	await repo.git(['commit', '-q', '--allow-empty', '-m', 'chore: not verified yet']);
	commits.unverified = await repo.git(['rev-parse', 'HEAD']);

	await repo.write(
		'src/utils/clock.ts',
		(await repo.read('src/utils/clock.ts')).replace('return value', 'return value.trim()')
	);
	commits.sourceOnly = await repo.commit('feat: trim the clock value');
}

/** Two reports from before Git-backed records: one names a commit of this history, one none. */
async function seedLegacyHistory(seed: ConsoleSeed): Promise<string> {
	const { root, repo, commits, verified, attacher } = seed;
	const legacy = { store: join(root, 'legacy-store'), project: repo.root };
	await legacyRun(legacy, 'linked-run', { title: 'Uppercase titles', revision: commits.shout }, 90);
	await legacyRun(legacy, 'unlinked-run', {
		title: 'Exploration without a revision',
		status: 'running',
		state: 'active'
	});
	await repo.harness(['history', 'import-reports', '--from', legacy.store]);
	await repo.git(['branch', '-q', explorerBranch, commits.approved]);
	Object.assign(commits, await seedShells(repo, { verified, explain }, commits.approved));
	await attacher.close();
	return repo.git(['for-each-ref', '--format=%(refname) %(objectname)']);
}

/** Builds the console data and scale data from the finished history, then records the metadata. */
async function writeConsoleOutputs(seed: ConsoleSeed, refs: string): Promise<void> {
	const { root, repo, commits } = seed;
	await repo.harness(['history', 'build', '--out', join(root, 'data')]);
	await writeScaleData(join(root, 'data'), join(root, 'scale'), {
		map: commits.sourceOnly,
		failed: commits.grown
	});
	await writeFile(
		join(root, 'meta.json'),
		JSON.stringify(
			{ repository: repo.root, commits, refs, keptBranch, explorerBranch, explorerUnits },
			null,
			'\t'
		)
	);
	console.log(`Synthetic history at ${repo.root}; console data in ${join(root, 'data')}`);
}

/** Builds the whole fixed history into the console fixture directory of the current run. */
export async function seedHarnessConsole(): Promise<void> {
	const seed = await openConsoleSeed(e2eFixtures().console);
	await seedShoutChange(seed);
	await seedTitlesPage(seed);
	await seedNativeCounters(seed);
	await seedKeptAndRetained(seed);
	await seedGrownSlugify(seed);
	await seedLoaderUnit(seed);
	await seedVerificationRuns(seed);
	await seedUnverifiedStates(seed);
	const refs = await seedLegacyHistory(seed);
	await writeConsoleOutputs(seed, refs);
}

if (import.meta.main) await seedHarnessConsole();
