import { testPath, metadata } from '../../../utils/verification-evidence/regressionFiles';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { fail } from '../../../core/development-tooling/errors';
import { EvidenceTreeAdapter } from '../../../adapters/verification-evidence/EvidenceTreeAdapter';
import { CommitTreeAdapter } from '../../../adapters/git-source-history/CommitTreeAdapter';
import { UnitRegistryRepository } from '../../../repositories/verification-evidence/UnitRegistryRepository';
import { pathMatches } from '../../../core/development-tooling/unitsConfig';
import { unitManifestPath } from '../../../utils/verification-evidence/regression-files/authoredInputs';
import { unitTestEdit } from '../../../utils/verification-evidence/regression-files/unitTestEdit';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type { UnitTestEdit } from '../../../utils/verification-evidence/regressionFiles.types';

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
	const tree = new EvidenceTreeAdapter(root);
	const units = await new UnitRegistryRepository(root).read(
		await CommitTreeAdapter.open(root, commit)
	);
	const disallowed: string[] = [];
	let strengthened = false;
	for (const path of changed) {
		const review = unitManifestPath(path)
			? await unitTestEdit(tree, commit, path, tests)
			: testFileEdit(path, tests, units.manifests);
		if (!review.allowed) disallowed.push(path);
		strengthened ||= review.strengthened;
	}
	if (disallowed.length)
		fail(
			`The failing-test commit must be test-only; product files changed: ${disallowed.join(', ')}.`
		);
	if (!strengthened) fail('The failing-test commit must strengthen a named test.');
}

function testFileEdit(path: string, tests: string[], units: ComponentManifest[]): UnitTestEdit {
	const owned = units.some((unit) => unit.owns.source.some((source) => pathMatches(path, source)));
	const test = testPath(path) || (tests.includes(path) && !owned);
	return { allowed: test || metadata(path), strengthened: test && tests.includes(path) };
}
