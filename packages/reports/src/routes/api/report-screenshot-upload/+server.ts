import { json, type RequestEvent } from '@sveltejs/kit';
import { R2ScreenshotStoreAdapter } from '../../../adapters/R2ScreenshotStoreAdapter';
import {
	ScreenshotUploadService,
	type ScreenshotUploadInput
} from '../../../services/ScreenshotUploadService';
import { repository } from '../../../utils/reportHttp';

function requestProblem(request: Request, url: URL) {
	if (request.headers.get('origin') !== url.origin)
		return json({ error: 'Same-origin upload required' }, { status: 403 });
	if (!request.headers.get('content-type')?.startsWith('multipart/form-data'))
		return json({ error: 'Multipart form required' }, { status: 415 });
	if (Number(request.headers.get('content-length') || 0) > 101_000_000)
		return json({ error: 'Upload exceeds size limit' }, { status: 413 });
	return null;
}

function uploadFields(form: FormData): ScreenshotUploadInput {
	const before = form.get('before');
	const after = form.get('after');
	if (!(before instanceof File) || !(after instanceof File))
		throw new Error('Choose both screenshots');
	return {
		title: String(form.get('title') || ''),
		viewport: String(form.get('viewport') || ''),
		before,
		after
	};
}

function uploadFailure(reason: unknown) {
	const message = reason instanceof Error ? reason.message : '';
	if (message.includes('not configured')) return json({ error: message }, { status: 503 });
	if (message.includes('finaliz')) return json({ error: message }, { status: 409 });
	if (message.includes('ENOENT')) return json({ error: 'Report not found' }, { status: 404 });
	if (/title|viewport|evidence|image|format|size|screenshots/i.test(message))
		return json({ error: message }, { status: 400 });
	return json({ error: 'Cloudflare upload failed; no evidence was added' }, { status: 502 });
}

export async function POST({ request, url }: RequestEvent) {
	const problem = requestProblem(request, url);
	if (problem) return problem;
	try {
		const form = await request.formData();
		const service = new ScreenshotUploadService(
			repository,
			R2ScreenshotStoreAdapter.fromEnvironment()
		);
		const report = await service.upload(String(form.get('reportId') || ''), uploadFields(form));
		return json(report, { status: 201, headers: { 'Cache-Control': 'no-store' } });
	} catch (reason) {
		return uploadFailure(reason);
	}
}
