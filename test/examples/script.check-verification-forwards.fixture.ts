import type { Tree } from './script.check-verification-forwards.test.types';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { checkVerificationForwards } from '../../scripts/check-verification-forwards';
import { withTempDir } from '../support/temporary';

/** Writes each path of the tree under root; a null value makes a folder instead of a file. */
function writeTree(root: string, tree: Tree): void {
	for (const [path, text] of Object.entries(tree)) {
		const full = join(root, path);
		if (text === null) mkdirSync(full, { recursive: true });
		else {
			mkdirSync(dirname(full), { recursive: true });
			writeFileSync(full, text);
		}
	}
}

/** Runs the check on a new temporary project folder holding the tree; the folder is removed. */
export function checkProject(tree: Tree): Promise<string[]> {
	return withTempDir('check-verification-forwards-', (root) => {
		writeTree(root, tree);
		return checkVerificationForwards(root);
	});
}
