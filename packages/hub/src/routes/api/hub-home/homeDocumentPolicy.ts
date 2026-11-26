import { z } from 'zod';
import { readOverviewText } from '../tracker-overview/trackerOverviewInput';
import { readHomeDocument, storeHomeDocument } from './homeDocumentStore';
import { readHomeSnapshot } from './homeStore';
import type { HomeDeps } from './homePolicy.types';

const documentId = z.string().regex(/^[0-9a-f]{64}$/);
const upload = z.object({ id: documentId, document: z.unknown() }).strict();
/** The 400 KB document limit, with room for JSON escapes. */
const maxUploadBytes = 1024 * 1024;

/** The Mac uploads one document; Hub keeps it only when its latest snapshot asked for it. */
export async function uploadHomeDocument(request: Request, deps: HomeDeps, actor: string) {
	if (!deps.bucket) return { status: 503, body: { error: 'unavailable' } };
	const input = upload.parse(JSON.parse(await readOverviewText(request, maxUploadBytes)));
	const snapshot = await readHomeSnapshot(deps.bucket, actor, deps.now);
	const kept = await storeHomeDocument(
		deps.bucket,
		actor,
		{ id: input.id, document: input.document },
		snapshot
	);
	return kept ? { status: 200, body: { ok: true } } : { status: 409, body: { error: 'refused' } };
}

/** The signed-in owner reads one document of an open ask. */
export async function browseHomeDocument(url: URL, deps: HomeDeps, actor: string) {
	if (!deps.bucket) return { status: 503, body: { error: 'unavailable' } };
	const id = documentId.parse(url.searchParams.get('id'));
	const document = await readHomeDocument(deps.bucket, actor, id);
	return document ? { status: 200, body: document } : { status: 404, body: { error: 'not-found' } };
}
