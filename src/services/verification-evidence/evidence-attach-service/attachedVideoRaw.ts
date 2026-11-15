// @harness-uid u_rfumv65ikl
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { VideoCaptureService } from '../VideoCaptureService';
import { eligibleVideoRecord, resolvedVideoAttachment } from './attachedVideoFlags';
import type { StoredRecord } from '../../../repositories/verification-evidence/VerificationStoreRepository';
import type { Attached } from './EvidenceAttachService.types';

/** Failed or late-flag attachments keep their raw diagnostics. Notes precede every cleanup. */
export async function finalizedVideoAttachment(
	root: string,
	stored: StoredRecord,
	attached: Attached
): Promise<Attached> {
	await resolvedVideoAttachment(root, stored.record, attached);
	const directories = new Set(
		stored.record.scenarios
			.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
			.filter(
				(capture) =>
					capture.kind === 'video' &&
					capture.videoReference &&
					!capture.videoReference.record &&
					capture.video &&
					eligibleVideoRecord(stored.record, capture.video.unit)
			)
			.map((capture) => dirname(capture.path))
	);
	const service = new VideoCaptureService(root);
	for (const directory of directories) {
		const path = join(stored.directory, directory),
			owned = relative(stored.directory, path);
		if (owned.startsWith('..') || !existsSync(join(path, 'video-raw-receipts.json'))) continue;
		await service.acknowledgeDirectory(path, stored.record.id);
	}
	return attached;
}
