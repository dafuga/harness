import { json, type RequestEvent } from '@sveltejs/kit';
import { AudioUploadService } from '../../../services/AudioUploadService';
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
function uploadFailure(reason: unknown) {
	const message = reason instanceof Error ? reason.message : '';
	if (message.includes('finaliz')) return json({ error: message }, { status: 409 });
	if (message.includes('ENOENT')) return json({ error: 'Report not found' }, { status: 404 });
	if (/audio|format|WAV|title|size/i.test(message))
		return json({ error: message }, { status: 400 });
	return json({ error: 'Audio comparison upload failed; no evidence was added' }, { status: 500 });
}
export async function POST({ request, url }: RequestEvent) {
	const problem = requestProblem(request, url);
	if (problem) return problem;
	try {
		const form = await request.formData();
		const before = form.get('before'),
			after = form.get('after');
		if (!(before instanceof File) || !(after instanceof File))
			throw new Error('Choose Before and After audio files');
		const report = await new AudioUploadService(repository).uploadComparison(
			String(form.get('reportId') || ''),
			{
				title: String(form.get('title') || ''),
				before,
				after,
				note: String(form.get('note') || ''),
				source: String(form.get('source') || '')
			}
		);
		return json(report, { status: 201, headers: { 'Cache-Control': 'no-store' } });
	} catch (reason) {
		return uploadFailure(reason);
	}
}
