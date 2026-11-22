// @harness-uid u_zhz7hjx43x
import type { FrameClip, FrameClipReference } from '../FrameFlagService.types';

export type ResolutionClip = Pick<
	FrameClip,
	'sha256' | 'inputHash' | 'capturedAt' | 'addressedFlags'
>;
export type ResolutionReader = (reference: FrameClipReference) => Promise<ResolutionClip>;
