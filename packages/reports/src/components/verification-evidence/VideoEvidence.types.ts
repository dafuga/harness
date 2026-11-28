// @harness-uid u_ytdcym5zkw
import type { Snippet } from 'svelte';
import type { Evidence } from '../../models/reports-media/Report.types';
import type { FrameFlag } from '../../../../../src/services/verification-evidence/FrameFlagService.types';

export interface VideoEvidenceProps {
	item: Evidence;
	assetBase: string;
	initialFlags?: FrameFlag[];
	playbackOnly?: boolean;
	metadata?: Snippet;
}
