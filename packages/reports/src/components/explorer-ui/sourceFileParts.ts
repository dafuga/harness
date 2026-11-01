import type { SourceFileParts } from './sourceFileParts.types';
/** @pure Split one source path after removing only its exact owner prefix. */
export function sourceFileParts(path: string, relativeTo: string): SourceFileParts {
	const shown = path.startsWith(relativeTo) ? path.slice(relativeTo.length) : path;
	const split = shown.lastIndexOf('/');
	return { folder: split < 0 ? '' : shown.slice(0, split), name: shown.slice(split + 1) };
}
