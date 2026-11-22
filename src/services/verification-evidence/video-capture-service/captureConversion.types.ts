// @harness-uid u_2eznkaf4qv
import type { VideoCaptureRawReceipt } from '../VideoCaptureService.types';
import type { VideoArchiveInput } from '../VideoArchiveService.types';
import type { Capture } from '../../../core/verification-evidence/verificationTypes';

export interface CaptureConversionContext {
	signatures: { entry?: string; exit?: string };
	cacheRoot: string;
}
export interface ConvertedCapture {
	archive: VideoArchiveInput;
	capture: Capture;
	raw: VideoCaptureRawReceipt;
}
