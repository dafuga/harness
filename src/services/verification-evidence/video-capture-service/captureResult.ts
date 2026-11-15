// @harness-uid u_2eznkaf4qv
import type {
	VideoCapturePlan,
	VideoCaptureResult,
	VideoCaptureSource
} from '../VideoCaptureService.types';
import type { captureProtocol } from './captureProtocol';

export function captureResult(
	source: VideoCaptureSource,
	plan: VideoCapturePlan,
	protocol: ReturnType<typeof captureProtocol>
): VideoCaptureResult {
	const result: VideoCaptureResult = {
		source,
		captures: [],
		videoBatches: [],
		recorded: plan.record,
		reused: plan.reuse.map((item) => item.slot),
		raw: []
	};
	for (const retained of plan.reuse) {
		protocol.append(retained.capture, retained.batches);
		result.captures.push(retained.capture);
		for (const pointer of retained.batches)
			if (!result.videoBatches.some((item) => item.batch === pointer.batch))
				result.videoBatches.push(pointer);
	}
	return result;
}
