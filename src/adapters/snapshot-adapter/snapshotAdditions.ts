import type { SnapshotBounds } from '../../utils/snapshotAdditions';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathMatches } from '../../core/unitsConfig';

/** True when a declared output pattern covers the file, or the directory, that the path names. */
export function declaredOutput(path: string, outputs: string[]): boolean {
	return outputs.some((pattern) => pathMatches(path, pattern) || pathMatches(`${path}/`, pattern));
}

/**
 * Lists files in a snapshot that the commit does not contain and no output declaration covers.
 * Declared outputs and shared links are not entered; everywhere else, wherever it is and
 * whatever it is called, a file that is not part of the commit is an addition.
 */
export async function snapshotAdditions(
	directory: string,
	bounds: SnapshotBounds,
	prefix = ''
): Promise<string[]> {
	const entries = await readdir(join(directory, prefix), { withFileTypes: true });
	const found = await Promise.all(
		entries.map(async (entry): Promise<string[]> => {
			const path = `${prefix}${entry.name}`;
			if (bounds.links.has(path) || declaredOutput(path, bounds.outputs)) return [];
			if (entry.isDirectory()) return snapshotAdditions(directory, bounds, `${path}/`);
			return bounds.tracked.has(path) ? [] : [path];
		})
	);
	return found.flat().sort();
}
