// @harness-uid u_2eznkaf4qv
import { join } from 'node:path';
import { z } from 'zod';
import { captureSchema } from '../../../core/verification-evidence/verificationTypes';
import { videoBatchPointerSchema } from '../../../utils/verification-evidence/videoClipSchema';
import { captureText } from './captureFiles';
import type { VideoCaptureResult } from '../VideoCaptureService.types';

const hash = z.string().regex(/^[a-f0-9]{64}$/),
	commit = z.string().regex(/^[a-f0-9]{40}$/);
const schema = z.strictObject({
	source: z.strictObject({ commit, tree: commit }),
	videoBatches: z.array(videoBatchPointerSchema).max(64),
	raw: z
		.array(
			z.strictObject({
				cacheRoot: z.string(),
				slotKey: z.string(),
				inputHash: hash,
				addressedFlags: z.array(hash).max(256),
				directory: z.string(),
				videoSha256: hash,
				posterSha256: hash,
				capture: captureSchema
			})
		)
		.max(4096)
});

export function captureReceiptStore(directory: string): VideoCaptureResult {
	const stored = schema.parse(
		JSON.parse(captureText(join(directory, 'video-raw-receipts.json'), 1024 * 1024))
	);
	return { ...stored, captures: stored.raw.map((raw) => raw.capture), recorded: [], reused: [] };
}
