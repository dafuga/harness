import { json, type RequestEvent } from '@sveltejs/kit';
import { AudioUploadService } from '../../../services/AudioUploadService';
import { repository } from '../../../utils/reportHttp';
function requestProblem(request: Request, url: URL) {
	if (request.headers.get('origin') !== url.origin)
		return json({ error: 'Same-origin upload required' }, { status: 403 });
	if (!request.headers.get('content-type')?.startsWith('multipart/form-data'))
		return json({ error: 'Multipart form required' }, { status: 415 });
	if (Number(request.headers.get('content-length') || 0) > 51_000_000)
		return json({ error: 'Upload exceeds size limit' }, { status: 413 });
	return null;
}
function uploadFailure(reason: unknown) {
	const message = reason instanceof Error ? reason.message : '';
	if (message.includes('finaliz')) return json({ error: message }, { status: 409 });
	if (message.includes('ENOENT')) return json({ error: 'Report not found' }, { status: 404 });
	if (/audio|format|WAV|title|size/i.test(message))
		return json({ error: message }, { status: 400 });
	return json({ error: 'Audio upload failed; no evidence was added' }, { status: 500 });
}
export async function POST({ request, url }: RequestEvent) {
	const problem = requestProblem(request, url);
	if (problem) return problem;
	try {
		const form = await request.formData();
		const audio = form.get('audio');
		if (!(audio instanceof File)) throw new Error('Choose an audio file');
		const input = {
			title: String(form.get('title') || ''),
			audio,
			note: String(form.get('note') || ''),
			source: String(form.get('source') || '')
		};
		const report = await new AudioUploadService(repository).upload(
			String(form.get('reportId') || ''),
			input
		);
		return json(report, { status: 201, headers: { 'Cache-Control': 'no-store' } });
	} catch (reason) {
		return uploadFailure(reason);
	}
}
