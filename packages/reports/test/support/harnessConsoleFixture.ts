import { mkdir, rm } from 'node:fs/promises';
import { baselineRepo, reviewer, type VerifyRepo } from '../../../../test/support/verifyRepo';
import type { ConsoleSeed, Verified } from './harnessConsoleFixture.types';
import { seedEmitted } from '../../scripts/harness-emitted-seed';
import { seedExplorer } from '../../scripts/harness-explorer-seed';
import { SeedAttacher } from '../../scripts/harness-seed-attacher';

/** The branch that keeps work after the history is built; the console lists it by name. */
export const keptBranch = 'feature/kept#1';
const tone = { FIXTURE_TRANSCRIPT: 'Synthetic test tone. No speech.' };
const head = (repo: VerifyRepo) => repo.git(['rev-parse', 'HEAD']);

/** Records the reason for every required change with the same behavior text. */
export const explain = (repo: VerifyRepo, behavior: string) =>
	repo.harness([
		'explain',
		'add',
		'--all',
		'--behavior',
		behavior,
		'--simplification',
		'A single guard clause was the smallest form found.',
		'--simplification-outcome',
		'not-improved',
		'--performance',
		'One length check and one scan per title; not measured.',
		'--performance-outcome',
		'not-applicable'
	]);

function verifierFor(attacher: SeedAttacher): Verified {
	return async (repo, env = {}, args = []) => {
		const outcome = await repo.verify(args, { ...tone, ...env });
		await attacher.attach(repo.root, { record: outcome.record.id });
		return outcome;
	};
}

/** Phase 1: a fresh root, the baseline repository and its first verified commit. */
export async function openConsoleSeed(root: string): Promise<ConsoleSeed> {
	await rm(root, { recursive: true, force: true });
	await mkdir(root, { recursive: true });
	const repo = await baselineRepo(seedExplorer);
	const attacher = await SeedAttacher.open(repo.root);
	const verified = verifierFor(attacher);
	const commits: Record<string, string> = { unbaselined: await repo.git(['rev-parse', 'HEAD~1']) };
	await attacher.attach(repo.root, { commit: commits.unbaselined });
	commits.baseline = await head(repo);
	await verified(repo);
	return { root, repo, attacher, commits, verified };
}

/** Phase 2: a plain source edit, verified on its own. */
export async function seedShoutChange(seed: ConsoleSeed) {
	const { repo, commits, verified } = seed;
	commits.shout = await repo.change('src/utils/slugify.ts', (source) =>
		source.replace('toLowerCase', 'toUpperCase')
	);
	await verified(repo);
}

/** Phase 3: the kept branch, and a unit whose two files change for one reason. */
export async function seedTitlesPage(seed: ConsoleSeed) {
	const { repo, commits, verified } = seed;
	// A branch that stays, with a slash and a character that must be encoded in a path.
	await repo.git(['checkout', '-q', '-b', keptBranch]);
	// One unit with two files, both changed for one reason: two recorded reasons that differ only
	// in the file they are about.
	const titles = 'src/routes/titles';
	await repo.write(`${titles}/+page.server.ts`, 'export const prerender = false;\n');
	await repo.harness(['units', 'index', '--write']);
	commits.paired = await repo.commit('feat: give the titles page a server file');
	await repo.explainAll(['--base', commits.shout, '--head', 'HEAD']);
	await verified(repo);
	await repo.write(`${titles}/+page.server.ts`, 'export const prerender = true;\n');
	await repo.write(
		`${titles}/+page.svelte`,
		(await repo.read(`${titles}/+page.svelte`)).replace("'Hello'", "'Hello again'")
	);
	await repo.harness(['units', 'index', '--write']);
	commits.twin = await repo.commit('feat: change both files of the titles page');
	await repo.explainAll(['--base', commits.paired, '--head', 'HEAD']);
	// Its reasons are kept in the notes of the commit, as a committed range's reasons are.
	await repo.harness(['history', 'reasons', '--base', commits.paired, '--commit', 'HEAD']);
	await verified(repo);
}

/**
 * Phase 4: native counters, one with bindings. Units in a language whose decision points are not
 * counted: one has nothing counted and its baseline says so; the other also has a counted file.
 */
export async function seedNativeCounters(seed: ConsoleSeed) {
	const { repo, commits, verified } = seed;
	const rust =
		'pub fn sign(value: i32) -> i32 {\n    if value < 0 {\n        return -1;\n    }\n    1\n}\n';
	await repo.write('crates/counter/Cargo.toml', '[package]\nname = "counter"\nversion = "0.1.0"\n');
	await repo.write('crates/counter/src/lib.rs', rust);
	await repo.write('crates/mixed/src/lib.rs', rust);
	await repo.write(
		'crates/mixed/bindings.ts',
		'export function bound(value: number): number {\n\tif (value > 1 && value < 9) return value;\n\treturn 0;\n}\n'
	);
	await repo.harness(['units', 'index', '--write']);
	await explain(repo, 'Adds two native counters written in Rust, one with TypeScript bindings.');
	commits.native = await repo.commit('feat: add native counters');
	const uncounted = await verified(repo);
	const native = ['budget', 'establish', 'kernel.counter', 'kernel.mixed', '--record'];
	await repo.harness([...native, uncounted.record.id, ...reviewer]);
	commits.measured = await repo.commit('chore: baselines for the native counters');
	await verified(repo);
	Object.assign(commits, await seedEmitted(repo, { verified, explain }));
}

/** Phase 5: work committed on the kept branch, then a retained branch that is deleted again. */
export async function seedKeptAndRetained(seed: ConsoleSeed) {
	const { repo, commits, verified } = seed;
	await repo.git(['commit', '-q', '--allow-empty', '-m', 'chore: work kept on a branch']);
	commits.kept = await head(repo);
	await repo.git(['checkout', '-q', 'main']);

	await repo.git(['checkout', '-q', '-b', 'feature/retained']);
	commits.retained = await repo.change('src/utils/clock.ts', (source) =>
		source.replaceAll('value', 'input')
	);
	await verified(repo);
	await repo.git(['checkout', '-q', 'main']);
	await repo.git(['branch', '-q', '-D', 'feature/retained']);
}

/** Phase 6: a slugify change that grows the function, approved through a recorded budget. */
export async function seedGrownSlugify(seed: ConsoleSeed) {
	const { repo, commits, verified } = seed;
	const grown = (await repo.read('src/utils/slugify.ts')).replace(
		'\treturn input',
		"\tif (input.length > 99 || input.includes('?')) return input;\n\treturn input"
	);
	await repo.write('src/utils/slugify.ts', grown);
	await repo.harness(['units', 'index', '--write']);
	await explain(repo, 'Leaves over-long and query-like titles unchanged instead of slugging them.');
	commits.grown = await repo.commit('feat: leave over-long titles unchanged');
	const blocked = await verified(repo);
	await repo.harness([
		'budget',
		'approve',
		'function.slugify',
		'--record',
		blocked.record.id,
		...reviewer
	]);
	commits.approved = await repo.commit('chore: approve the larger slugify');
	await verified(repo);
}

/** Phase 7: a run-time loader added, baselined, then removed and retired. */
export async function seedLoaderUnit(seed: ConsoleSeed) {
	const { repo, commits, verified } = seed;
	await repo.write(
		'src/utils/extra.ts',
		'export function extra(name: string): Promise<unknown> {\n\treturn import(name);\n}\n'
	);
	await repo.harness(['units', 'index', '--write']);
	await explain(repo, 'Adds a loader whose target is only known at run time.');
	commits.added = await repo.commit('feat: add a run-time loader');
	const unbaselined = await verified(repo);
	await repo.harness([
		'budget',
		'establish',
		'function.extra',
		'--record',
		unbaselined.record.id,
		...reviewer
	]);
	commits.established = await repo.commit('chore: baseline for the loader');
	await verified(repo);

	await repo.git(['rm', '-q', 'src/utils/extra.ts']);
	await repo.harness(['units', 'retire', 'function.extra', '--reason', 'Nothing used the loader.']);
	await repo.harness(['units', 'index', '--write']);
	await explain(repo, 'Removes the unused loader.');
	commits.removed = await repo.commit('cleanup: remove the unused loader');
	await verified(repo);
}
