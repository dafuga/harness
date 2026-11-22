import type { PlatformCatalog } from '../../../src/core/explorer-ui/Platform.types';
import type { HarnessRevision } from '../src/models/explorer-ui/Harness.types';

export const invalidPlatformCatalog: PlatformCatalog = {
	entries: [],
	gap: 'Platform configuration could not be read at this revision. Check harness.platforms.json.'
};

/** Allow the Platforms route tests to hold or corrupt one synthetic response. */
export async function platformPreviewReply(path: string, detail: HarnessRevision) {
	const probe = (
		window as Window & {
			previewPlatformResponse?: (path: string) => Promise<boolean>;
		}
	).previewPlatformResponse;
	return (await probe?.(path)) ? new Response('{') : Response.json(detail);
}
