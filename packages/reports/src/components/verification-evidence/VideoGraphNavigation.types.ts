// @harness-uid u_d526lwxlsr
import type { VideoManifest } from '../../../../../src/utils/verification-evidence/videoClipSchema.types';
import type { VideoGraphCoverage } from '../../../../../src/services/verification-evidence/VideoEvidenceService.types';

export interface VideoGraphNavigationProps {
	library: Pick<VideoManifest, 'graphs' | 'playlists'> & {
		discoveryGaps?: { unit: string; reason: string }[];
	};
	coverage?: VideoGraphCoverage[];
	selected?: string;
}
