// @harness-uid u_2eznkaf4qv
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import type { VideoCaptureResult, VideoCaptureServices } from '../VideoCaptureService.types';
import type { convertedCapture } from './captureConversion';
import type { captureProtocol } from './captureProtocol';

/** One bounded pending child; completed media buffers are released before the next child. */
export function captureBatch(
	archive: NonNullable<VideoCaptureServices['archive']>,
	protocol: ReturnType<typeof captureProtocol>,
	result: VideoCaptureResult
) {
	let pending: ReturnType<typeof convertedCapture>[] = [],
		bytes = 0;
	const flush = async () => {
		if (!pending.length) return;
		const pointers = await archive.write(pending.map((item) => item.archive));
		if (pointers.length !== 1)
			throw new ExpectedCliError(
				'Bounded capture child did not produce exactly one archive receipt.'
			);
		const pointer = pointers[0];
		for (const item of pending) {
			const capture = { ...item.capture, videoReference: { batch: pointer.batch } };
			protocol.append(capture, pointers);
			result.captures.push(capture);
			result.raw.push({ ...item.raw, capture });
		}
		result.videoBatches.push(pointer);
		pending = [];
		bytes = 0;
	};
	return {
		async append(item: ReturnType<typeof convertedCapture>) {
			const size = item.archive.videoBytes.length + item.archive.posterBytes.length;
			if (pending.length && (pending.length === 64 || bytes + size > 512 * 1024 * 1024))
				await flush();
			pending.push(item);
			bytes += size;
		},
		flush
	};
}
