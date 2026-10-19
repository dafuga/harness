import { EvidenceTreeAdapter } from '../adapters/EvidenceTreeAdapter';
import { GitAdapter } from '../adapters/GitAdapter';
import { CommitTreeAdapter } from '../adapters/CommitTreeAdapter';
import { UnitRegistryRepository } from '../repositories/UnitRegistryRepository';
import { pathMatches } from '../core/unitsConfig';
import { fail } from '../core/errors';
import type { RegressionRecord } from '../core/regressionTypes';

const testPath = (path: string) =>
	/(^|\/)(test|tests|e2e|fixtures|__tests__|__snapshots__)\//.test(path) ||
	/\.(test|spec)\.[^/]+$/.test(path) ||
	path.startsWith('specification/scenarios/');
const configuration = (path: string) =>
	/(^|\/)(package\.json|bun\.lockb?|[\w.-]*lock\.ya?ml|[\w.-]*\.config\.[^/]+|tsconfig[^/]*\.json|harness\.verify\.json)$/.test(
		path
	);
const metadata = (path: string) => path.startsWith('specification/loops/') || path.endsWith('.md');

/** Freeze the complete test corpus, including shared fixtures and runner configuration. */
export async function regressionFiles(root: string, commit: string, tests: string[]) {
	if (!tests.length) return fail('Name the strengthened test with --test.');
	const files = await new EvidenceTreeAdapter(root).list(commit);
	const units = await new UnitRegistryRepository(root).read(
		await CommitTreeAdapter.open(root, commit)
	);
	for (const path of tests) {
		if (!files.has(path) || path.startsWith('/') || path.split('/').includes('..'))
			fail(`Regression test ${path} is not a tracked file of this commit.`);
		if (
			!testPath(path) &&
			units.manifests.some((unit) => unit.owns.source.some((source) => pathMatches(path, source)))
		)
			fail(`Product source ${path} cannot be declared as the regression test.`);
	}
	return [...files]
		.filter(([path]) => tests.includes(path) || testPath(path) || configuration(path))
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([path, hash]) => ({ path, hash }));
}

/** A failing checkpoint adds coverage; no product repair may be hidden in that commit. */
export async function regressionTestCommit(
	root: string,
	commit: string,
	tests: string[]
): Promise<void> {
	const git = new GitAdapter(root);
	const changed = (await git.run(['diff', '--name-only', `${commit}^`, commit]))
		.split('\n')
		.filter(Boolean);
	const disallowed = changed.filter(
		(path) => !tests.includes(path) && !testPath(path) && !metadata(path)
	);
	if (disallowed.length)
		fail(
			`The failing-test commit must be test-only; product files changed: ${disallowed.join(', ')}.`
		);
	if (!changed.some((path) => tests.includes(path)))
		fail('The failing-test commit must strengthen a named test.');
}

/** The fix descends from a different commit and changes none of the frozen test inputs. */
export async function regressionFixCommit(
	root: string,
	commit: string,
	red: RegressionRecord
): Promise<void> {
	const tree = new EvidenceTreeAdapter(root);
	if (commit === red.source.commit || !(await tree.contains(commit, red.source.commit)))
		fail('Record a separate fix commit descended from the failing-test commit.');
	const inputs = await regressionFiles(root, commit, red.tests);
	if (JSON.stringify(inputs) !== JSON.stringify(red.inputs))
		fail('The regression tests, fixtures and runner configuration must remain unchanged.');
	const changed = (await tree.git.run(['diff', '--name-only', `${commit}^`, commit]))
		.split('\n')
		.filter(Boolean);
	if (!changed.some((path) => !testPath(path) && !metadata(path) && !configuration(path)))
		fail('The separate fix commit must change product code.');
}
