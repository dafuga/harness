// @harness-uid u_ykuzjqiekn
import { admitUploadRequest } from '../../../utils/reports-media/admitUploadRequest';
import { json } from '@sveltejs/kit';
import { R2ScreenshotStoreAdapter } from '../../../adapters/reports-media/R2ScreenshotStoreAdapter';
import { ScreenshotUploadService, type ScreenshotUploadInput } from './ScreenshotUploadService';
import { repository } from '../../../utils/reports-media/reportHttp';

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

export async function POST({ request, url }: { request: Request; url: URL }): Promise<Response> {
	const problem = admitUploadRequest(request, url.origin, 101_000_000);
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
