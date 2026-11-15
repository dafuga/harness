// @harness-uid u_2eznkaf4qv
import { realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { NativeVideoRecorderService } from '../NativeVideoRecorderService';
import { sameSlot } from './captureSelection';
import type {
	VideoCaptureResult,
	VideoCaptureServices,
	VideoCaptureRawReceipt
} from '../VideoCaptureService.types';

/** Archive objects alone never authorize raw cleanup: the exact clip needs its attached parent receipt. */
export async function captureReceipt(
	root: string,
	result: VideoCaptureResult,
	record: string,
	services: VideoCaptureServices
): Promise<void> {
	if (!/^[a-f0-9]{64}$/.test(record))
		throw new ExpectedCliError(
			'Video raw cleanup requires an attached verification record receipt.'
		);
	for (const raw of result.raw)
		await cleanupRaw(root, raw, { source: result.source, record }, services);
}

async function cleanupRaw(
	root: string,
	raw: VideoCaptureRawReceipt,
	receipt: { source: VideoCaptureResult['source']; record: string },
	services: VideoCaptureServices
): Promise<void> {
	const base = realpathSync(join(root, '.cache/harness/video-capture')),
		relativeRoot = relative(base, realpathSync(raw.cacheRoot));
	if (!/^run-[\w-]+$/.test(relativeRoot))
		throw new ExpectedCliError('Video raw cleanup escaped this task-owned run cache.');
	const slot = {
		unit: raw.capture.video!.unit,
		clipId: raw.capture.video!.clipId,
		viewport: raw.capture.viewport!,
		inputHash: raw.inputHash
	};
	const candidates = await services.references!.candidates(slot);
	const candidate = candidates.find(
		(item) =>
			item.parent.record === receipt.record &&
			sameSlot(slot, {
				unit: item.capture.video!.unit,
				clipId: item.capture.video!.clipId,
				viewport: item.capture.viewport!
			}) &&
			item.capture.sha256 === raw.videoSha256
	);
	if (!candidate)
		throw new ExpectedCliError('Video raw cleanup receipt has no exact parent-linked capture.');
	const verified = await services.references!.resolve({
		source: receipt.source,
		capture: candidate.capture,
		batches: candidate.batches
	});
	if (
		verified.inputHash !== raw.inputHash ||
		verified.clip.media.sha256 !== raw.videoSha256 ||
		verified.clip.poster.sha256 !== raw.posterSha256
	)
		throw new ExpectedCliError('Video raw cleanup receipt does not retain its canonical pair.');
	const native = services.native?.(raw.cacheRoot) ?? new NativeVideoRecorderService(raw.cacheRoot);
	const saved = await native.lookup(raw.slotKey, raw.inputHash, raw.addressedFlags);
	if (saved?.directory !== raw.directory)
		throw new ExpectedCliError('Video raw cleanup cannot identify its finalized native attempt.');
	await native.acknowledge(saved, {
		record: receipt.record,
		videoSha256: raw.videoSha256,
		posterSha256: raw.posterSha256
	});
}
