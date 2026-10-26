import { EvidenceTreeAdapter } from '../../adapters/verification-evidence/EvidenceTreeAdapter';
import { CommitTreeAdapter } from '../../adapters/git-source-history/CommitTreeAdapter';
import { UnitRegistryRepository } from '../../repositories/verification-evidence/UnitRegistryRepository';
import { pathMatches } from '../../core/development-tooling/unitsConfig';
import { fail } from '../../core/development-tooling/errors';
import type { RegressionRecord } from '../../core/verification-evidence/regressionTypes';
import type { FrozenRegressionInputs } from './regressionFiles.types';
import { authoredInputs, unitManifestPath } from './regression-files/authoredInputs';
import { canonicalJson } from '../development-tooling/canonicalJson';

export const testPath = (path: string) =>
	/(^|\/)(test|tests|e2e|fixtures|__tests__|__snapshots__)\//.test(path) ||
	/\.(test|spec)\.[^/]+$/.test(path) ||
	path.startsWith('specification/scenarios/');

const configuration = (path: string) =>
	/(^|\/)(package\.json|bun\.lockb?|[\w.-]*lock\.ya?ml|[\w.-]*\.config\.[^/]+|tsconfig[^/]*\.json|harness\.verify\.json)$/.test(
		path
	);

export const metadata = (path: string) =>
	path.startsWith('specification/loops/') || path.endsWith('.md');

/** Freeze the complete test corpus, including shared fixtures and runner configuration. */
export async function regressionFiles(
	root: string,
	commit: string,
	tests: string[]
): Promise<FrozenRegressionInputs> {
	if (!tests.length) return fail('Name the strengthened test with --test.');
	const tree = new EvidenceTreeAdapter(root);
	const files = await tree.list(commit);
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
	return {
		inputs: [...files]
			.filter(([path]) => {
				const selected = tests.includes(path) || testPath(path) || configuration(path);
				return !unitManifestPath(path) && selected;
			})
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([path, hash]) => ({ path, hash })),
		expectations: await authoredInputs(tree, commit, files)
	};
}

/** The fix descends from a different commit and changes none of the frozen test inputs. */
export async function regressionFixCommit(
	root: string,
	commit: string,
	red: RegressionRecord
): Promise<void> {
	const tree = new EvidenceTreeAdapter(root);
	let source = red.source.commit;
	if (commit === source)
		fail('Record a separate fix commit descended from the failing-test commit.');
	source = red.source.commit;
	if (!(await tree.contains(commit, source)))
		fail('Record a separate fix commit descended from the failing-test commit.');
	const frozen = await regressionFiles(root, commit, red.tests);
	// Keep the existing native JSON traversal: array iterators and species are not consulted.
	const inputs = JSON.stringify(red.inputs);
	if (!inputs || JSON.stringify(frozen.inputs) !== inputs)
		fail('The regression tests, fixtures and runner configuration must remain unchanged.');
	const authored = red.expectations;
	if (!authored)
		fail(
			'The failing checkpoint lacks frozen authored expectations; record red with the current CLI.'
		);
	const recorded: FrozenRegressionInputs = {
		inputs: JSON.parse(inputs),
		expectations: JSON.parse(JSON.stringify(authored))
	};
	await checkOrigin(tree, source, recorded);
	if (
		canonicalJson(expectationValues(frozen.expectations)) !==
		canonicalJson(expectationValues(recorded.expectations))
	)
		fail('The authored regression expectations must remain unchanged.');
	const changed = (await tree.git.run(['diff', '--name-only', `${commit}^`, commit]))
		.split('\n')
		.filter(Boolean);
	if (!changed.some((path) => !testPath(path) && !metadata(path) && !configuration(path)))
		fail('The separate fix commit must change product code.');
}

export { regressionTestCommit } from '../../workflows/verification-evidence/record-regression/regressionFiles';

function expectationValues(expectations: FrozenRegressionInputs['expectations']) {
	return expectations.map(({ unit, path, sha256 }) => ({ unit, path, sha256 }));
}

/** Verify the complete original corpus and every recorded extra against immutable Git blobs. */
async function checkOrigin(
	tree: EvidenceTreeAdapter,
	commit: string,
	recorded: FrozenRegressionInputs
): Promise<void> {
	const files = await tree.list(commit);
	const named = new Set(recorded.inputs.map((input) => input.path));
	const origin: FrozenRegressionInputs = {
		inputs: [...files]
			.filter(
				([path]) =>
					!unitManifestPath(path) && (named.has(path) || testPath(path) || configuration(path))
			)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([path, hash]) => ({ path, hash })),
		expectations: await authoredInputs(tree, commit, files)
	};
	if (canonicalJson(origin) !== canonicalJson(recorded))
		fail('The failing checkpoint inputs do not match their committed Git provenance.');
}
