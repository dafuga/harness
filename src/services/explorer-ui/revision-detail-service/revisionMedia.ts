// @harness-uid u_x5bcnj5gs4
import { shortCommit } from '$reports/helpers/strings/shortCommit';
import { posix } from 'node:path';
import type { AttachedRecord } from '../../verification-evidence/history-status-service/attached-record-service/AttachedRecordService.types';
import type { MediaPlacer } from '../../../utils/development-tooling/mediaPlace';
import type { Capture, ResolvedMedia } from '../../../utils/development-tooling/recordView.types';
import type { OriginRecordReader } from './RevisionDetailService.types';

export async function revisionMedia(
	loaded: AttachedRecord,
	media: MediaPlacer,
	read: OriginRecordReader
): Promise<Map<string, ResolvedMedia>> {
	const resolved = new Map<string, ResolvedMedia>(),
		record = loaded.record;
	if (!record) return resolved;
	const own = record.id;
	for (const scenario of record.scenarios)
		for (const capture of scenario.states.flatMap((state) => state.captures)) {
			const origin = capture.videoReference?.record ?? scenario.referencedRecord ?? own;
			const source = origin === own ? loaded : await read(origin);
			resolved.set(
				`${origin}\n${capture.path}`,
				await placeCapture(media, capture, source, origin)
			);
		}
	return resolved;
}

async function placeCapture(
	media: MediaPlacer,
	capture: Capture,
	source: AttachedRecord | undefined,
	origin: string
): Promise<ResolvedMedia> {
	const placed = await media.place(
		source?.files.get(capture.path),
		capture,
		gapFor(source, capture.path, origin)
	);
	if (capture.video) {
		const poster = {
			path: posix.join(posix.dirname(capture.path), capture.video.poster.file),
			sha256: capture.video.poster.sha256
		};
		placed.poster = await media.place(
			source?.files.get(poster.path),
			poster,
			gapFor(source, poster.path, origin)
		);
	}
	return placed;
}

function gapFor(source: AttachedRecord | undefined, path: string, origin: string): string {
	if (!source) return `inherited record ${shortCommit(origin)} is not available`;
	return (
		source.problems.find((problem) => problem.includes(path)) ??
		`${path} is not part of record ${shortCommit(origin)}`
	);
}
