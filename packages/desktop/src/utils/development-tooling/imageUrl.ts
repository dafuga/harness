import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';

export interface ImageRequest {
	entityId: string;
	version: string;
	sha256: string;
}

/**
 * Reads an image of the shown project and commit into an object URL. Call it inside an effect
 * and return its result: a change of project or commit then drops the image and reads again.
 */
export function imageUrl(
	workspace: Workspace,
	request: ImageRequest | null,
	apply: (url: string, error: string) => void
): () => void {
	const bridge = workspace.bridge;
	const commit = workspace.snapshot?.revision.commit;
	const context = workspace.context;
	let disposed = false;
	let url = '';
	apply('', '');
	if (request && bridge && commit)
		void bridge
			.image({ ...request, commit, ...context })
			.then((bytes) => {
				if (disposed) return;
				url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
				apply(url, '');
			})
			.catch((cause: unknown) => {
				if (!disposed) apply('', String(cause));
			});
	return () => {
		disposed = true;
		if (url) URL.revokeObjectURL(url);
	};
}
