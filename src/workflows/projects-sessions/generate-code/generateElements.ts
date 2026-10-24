import { ensureParents, writePlannedFiles } from '../../../core/development-tooling/files';
import { atomicComponentFiles } from '../../../templates/development-tooling/atomicComponents';
import { detectProjectKind } from './project';
import { fail } from '../../../core/development-tooling/errors';
import type { GenerateResult } from './generateCode.types';
import { atomLibrary } from './atomLibrary';

/** Install the canonical native atom library without replacing a project's design system. */
export async function generateElements(
	input: { root?: string; force?: boolean } = {}
): Promise<GenerateResult> {
	const root = input.root ?? process.cwd();
	if (!['app', 'game'].includes(await detectProjectKind(root)))
		fail('Elements require a Harness app project.');
	if (atomLibrary(root) !== 'src/components/atoms')
		return {
			kind: 'elements',
			name: 'existing shared native atom library',
			writes: [],
			exportsUpdated: false
		};
	const files = atomicComponentFiles();
	await ensureParents(root, files);
	return {
		kind: 'elements',
		name: 'HTML and SVG atoms',
		writes: await writePlannedFiles(root, files, { force: input.force }),
		exportsUpdated: false
	};
}
