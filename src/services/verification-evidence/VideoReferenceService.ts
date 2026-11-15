// @harness-uid u_alfe4qnget
import { resolveVideoReference } from './video-reference-service/resolve';
import { materializeVideoReferences } from './video-reference-service/materialize';
import { videoReferenceCandidates } from './video-reference-service/candidates';
import type { VerificationRecord } from '../../core/verification-evidence/verificationTypes';
import type {
	TrustedVideoReference,
	VideoReferenceContext,
	VideoReferenceInput,
	VideoReferenceCandidate,
	VideoReferenceSelection
} from './VideoReferenceService.types';

export class VideoReferenceService {
	constructor(
		private readonly root: string = process.cwd(),
		private readonly pinned?: VideoReferenceContext['pinned'],
		private readonly trail: string[] = []
	) {}

	run(): string {
		return 'video-reference';
	}

	/** Archive/original-parent integrity only; the caller must independently prove current input closure. */
	resolve(input: VideoReferenceInput): Promise<TrustedVideoReference> {
		return resolveVideoReference(this.root, input, { pinned: this.pinned, trail: this.trail });
	}

	materialize(record: VerificationRecord, physical?: string[]): Promise<Map<string, Buffer>> {
		return materializeVideoReferences(this.root, record, {
			context: { pinned: this.pinned, trail: this.trail },
			physical
		});
	}

	candidates(selection: VideoReferenceSelection): Promise<VideoReferenceCandidate[]> {
		return videoReferenceCandidates(this.root, selection, {
			pinned: this.pinned,
			trail: this.trail
		});
	}
}

export type {
	TrustedVideoReference,
	VideoReferenceInput,
	VideoReferenceCandidate,
	VideoReferenceSelection
} from './VideoReferenceService.types';
