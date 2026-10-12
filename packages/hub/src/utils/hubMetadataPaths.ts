import type { SourceEntry } from 'collaboration';

/** Text metadata only; image bytes and owned source remain on their individual read paths. */
export function hubMetadataPaths(entries: SourceEntry[]): string[] {
	return entries
		.filter((entry) => entry.type === 'blob' && ['100644', '100755'].includes(entry.mode))
		.map((entry) => entry.path)
		.filter(
			(path) =>
				/^specification\/units\/[^/]+\.json$/.test(path) ||
				/^src\/(pages|components|functions|configs|services)\/[^/]+\/(plan\.json|designs\/.*\.(json|md))$/.test(
					path
				)
		);
}
