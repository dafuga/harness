// @harness-uid u_2jb3ivcxjb
import { admitUploadRequest } from '../../../utils/reports-media/admitUploadRequest';
import { json } from '@sveltejs/kit';
import { AudioUploadService } from '../../../services/reports-media/AudioUploadService';
import { repository } from '../../../utils/reports-media/reportHttp';
class InvalidAudioFileError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InvalidAudioFileError';
	}
}
function uploadFailure(reason: unknown) {
	const message = reason instanceof Error ? reason.message : '';
	if (message.includes('finaliz')) return json({ error: message }, { status: 409 });
	if (message.includes('ENOENT')) return json({ error: 'Report not found' }, { status: 404 });
	if (/audio|format|WAV|title|size/i.test(message))
		return json({ error: message }, { status: 400 });
	return json({ error: 'Audio upload failed; no evidence was added' }, { status: 500 });
}
export async function POST({ request, url }: { request: Request; url: URL }): Promise<Response> {
	const problem = admitUploadRequest(request, url.origin, 51_000_000);
	if (problem) return problem;
	try {
		const form = await request.formData();
		const audio = form.get('audio');
		if (!(audio instanceof File)) throw new InvalidAudioFileError('Choose an audio file');
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
