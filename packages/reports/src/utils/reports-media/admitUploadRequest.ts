// @harness-uid u_usrudrxset
import { json } from '@sveltejs/kit';

/** Admit only same-origin multipart requests within the caller's media-specific header limit. */
export function admitUploadRequest(
	request: Request,
	targetOrigin: string,
	limit: number
): Response | null {
	if (request.headers.get('origin') !== targetOrigin)
		return json({ error: 'Same-origin upload required' }, { status: 403 });
	if (!request.headers.get('content-type')?.startsWith('multipart/form-data'))
		return json({ error: 'Multipart form required' }, { status: 415 });
	if (Number(request.headers.get('content-length') || 0) > limit)
		return json({ error: 'Upload exceeds size limit' }, { status: 413 });
	return null;
}
