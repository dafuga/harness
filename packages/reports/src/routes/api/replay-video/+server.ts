import { error, type RequestEvent } from '@sveltejs/kit';
import { ReplayVideoService } from "../../../services/replay-video-service/ReplayVideoService";
import { mediaResponse } from '../../../utils/mediaResponse';
import { repository } from '../../../utils/reportHttp';
const service = new ReplayVideoService(repository);
export async function GET({ url, request }: RequestEvent) {
	const id = url.searchParams.get('run');
	if (!id || !/^[a-f0-9-]{36}$/.test(id)) error(400, 'A valid report ID is required');
	// A report this site does not have is absent, whatever could be rendered from it.
	await repository.get(id).catch(() => error(404, 'Report not found'));
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
