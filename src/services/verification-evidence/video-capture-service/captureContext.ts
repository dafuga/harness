// @harness-uid u_2eznkaf4qv
import { z } from 'zod';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import type { VideoCaptureInput, VideoCaptureEnvironment } from '../VideoCaptureService.types';

const commit = z.string().regex(/^[a-f0-9]{40}$/),
	hash = z.string().regex(/^[a-f0-9]{64}$/);
const schema = z.strictObject({
	schemaVersion: z.literal(1),
	repository: z.string().min(1),
	snapshot: z.string().min(1),
	source: z.strictObject({ commit, tree: commit }),
	pinned: z.strictObject({ evidence: commit.nullable(), notes: commit.nullable() }),
	slots: z
		.array(
			z.strictObject({
				unit: z.string().min(1),
				clipId: z.string().min(1),
				viewport: z.string().min(1),
				inputHash: hash,
				reasons: z.array(z.string().max(2048)).max(32).optional()
			})
		)
		.max(4096)
});

export function captureContext(
	input: VideoCaptureInput,
	root: string
): VideoCaptureEnvironment | undefined {
	const encoded = input.env?.HARNESS_VIDEO_CAPTURE_CONTEXT;
	if (!encoded) return undefined;
	if (Buffer.byteLength(encoded) > 60 * 1024)
		throw new ExpectedCliError('Video capture context exceeds 60 KiB.');
	const context = schema.parse(JSON.parse(encoded));
	if (
		context.repository !== root ||
		context.snapshot !== input.snapshot ||
		context.source.commit !== input.source.commit ||
		context.source.tree !== input.source.tree
	)
		throw new ExpectedCliError(
			'Video capture context does not match its exact repository/source export.'
		);
	return context;
}
