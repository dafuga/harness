import { testPath, metadata } from '../../utils/regressionFiles';
import { GitAdapter } from '../../adapters/GitAdapter';
import { fail } from '../../core/errors';

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
