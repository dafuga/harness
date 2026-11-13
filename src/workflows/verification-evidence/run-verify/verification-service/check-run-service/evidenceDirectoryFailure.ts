// @harness-uid u_rzyz4jar6z
import { lstatSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

/** Check every component beneath the trusted run root without following directory symlinks. */
export function evidenceDirectoryFailure(directory: string, root: string): string | undefined {
	const path = relative(resolve(root), resolve(directory));
	const failure =
		'capture directory ancestry must contain regular directories beneath the run root';
	if (isAbsolute(path) || path.split(sep).includes('..')) return failure;
	let current = resolve(root);
	for (const part of ['', ...path.split(sep).filter(Boolean)]) {
		current = join(current, part);
		try {
			if (!lstatSync(current).isDirectory()) return failure;
		} catch (error) {
			return (error as { code?: string }).code === 'ENOENT' ? undefined : failure;
		}
	}
	return undefined;
}
