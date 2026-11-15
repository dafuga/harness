// @harness-uid u_ytdcym5zkw
import type { EvidenceVideo } from '../../../models/reports-media/Report.types';
import type { FrameFlag } from '../../../../../../src/services/verification-evidence/FrameFlagService.types';

/** The API returns errors as JSON; retain their explanation for the reviewer. */
async function reply(response: Response): Promise<Record<string, unknown>> {
	const body = await response.json().catch(() => ({}));
	if (!response.ok)
		throw new FrameFeedbackFailure(
			String(body.error ?? `Frame feedback failed (${response.status}).`)
		);
	return body;
}

export async function loadVideoFlags(
	video: EvidenceVideo,
	signal: AbortSignal
): Promise<FrameFlag[]> {
	const reference = video.reference;
	if (!reference) return [];
	const query = new URLSearchParams({
		unit: reference.unit,
		clipId: reference.clipId,
		viewport: reference.viewport,
		sha256: video.sha256
	});
	const body = await reply(await fetch(`/api/video-flags?${query}`, { signal }));
	if (!Array.isArray(body.flags))
		throw new FrameFeedbackFailure('Frame feedback returned no flags list.');
	return body.flags as FrameFlag[];
}

export async function submitVideoFlag(
	video: EvidenceVideo,
	frameNumber: number,
	note: string,
	signal: AbortSignal
): Promise<FrameFlag> {
	if (!video.reference) throw new FrameFeedbackFailure('No attached clip reference is available.');
	const body = await reply(
		await fetch('/api/video-flags', {
			method: 'POST',
			signal,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ clip: video.reference, frameNumber, note, source: 'human' })
		})
	);
	if (!body.flag || typeof body.flag !== 'object')
		throw new FrameFeedbackFailure('Frame feedback returned no saved flag.');
	return body.flag as FrameFlag;
}

class FrameFeedbackFailure extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'FrameFeedbackFailure';
	}
}
