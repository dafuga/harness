import { admitUploadRequest } from '../../../utils/reports-media/admitUploadRequest';
import { json } from '@sveltejs/kit';
import { AudioUploadService } from '../../../services/reports-media/AudioUploadService';
import { repository } from '../../../utils/reports-media/reportHttp';
function uploadFailure(reason: unknown) {
	const message = reason instanceof Error ? reason.message : '';
	if (message.includes('finaliz')) return json({ error: message }, { status: 409 });
	if (message.includes('ENOENT')) return json({ error: 'Report not found' }, { status: 404 });
	if (/audio|format|WAV|title|size/i.test(message))
		return json({ error: message }, { status: 400 });
	return json({ error: 'Audio comparison upload failed; no evidence was added' }, { status: 500 });
}
export async function POST({ request, url }: { request: Request; url: URL }): Promise<Response> {
	const problem = admitUploadRequest(request, url.origin, 101_000_000);
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
