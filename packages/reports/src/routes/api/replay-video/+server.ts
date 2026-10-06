import { error, type RequestEvent } from '@sveltejs/kit';
import { ReplayVideoService } from '../../../services/ReplayVideoService';
import { mediaResponse } from '../../../utils/mediaResponse';
const service = new ReplayVideoService();
export async function GET({ url, request }: RequestEvent) {
	const id = url.searchParams.get('run');
	if (!id || !/^[a-f0-9-]{36}$/.test(id)) error(400, 'A valid report ID is required');
	try {
		const bytes = await service.create(id);
		return mediaResponse(
			bytes,
			'video/mp4',
			request.headers.get('range'),
			`attachment; filename="gameplay-replay-${id}.mp4"`
		);
	} catch (reason) {
		const message = reason instanceof Error ? reason.message : 'Video unavailable';
		error(
			400,
			message.startsWith('Replay requires')
				? message
				: 'Video unavailable. The screenshot replay remains available.'
		);
	}
}
