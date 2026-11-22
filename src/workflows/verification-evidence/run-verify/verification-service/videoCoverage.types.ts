// @harness-uid u_lnqhwcablp
import type { VideoGraphCoverage } from '../../../../services/verification-evidence/VideoEvidenceService.types';
export interface VideoCoverageReport {
	failures: string[];
	graphs: VideoGraphCoverage[];
}
