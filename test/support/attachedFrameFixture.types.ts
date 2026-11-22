import type { FrameClipReference } from '../../src/services/verification-evidence/FrameFlagService.types';
export interface AttachedFrameOptions {
	root: string;
	git: (...args: string[]) => string;
	reference: FrameClipReference;
	video: Buffer;
	addressedFlags?: string[];
	capturedAt?: string;
	standing: 'full' | 'scoped' | 'wrong-owner' | 'failed';
}
