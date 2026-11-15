// @harness-uid u_nfctcgnv7g
import { videoClipSchema } from '../../utils/verification-evidence/videoClipSchema';
import type { VideoDeclaration } from '../../utils/verification-evidence/videoClipSchema.types';
import { clipInputSlot } from './video-evidence-service/clipInputs';
import { createClipInputContext } from './video-evidence-service/clipInputFiles';
import { graphCoverage } from './video-evidence-service/graphCoverage';
import type {
	VideoSlot,
	VideoObservation,
	VideoPlan,
	VideoGraphCoverage
} from './VideoEvidenceService.types';

export class VideoEvidenceService {
	private readonly root: string;
	constructor(root?: string) {
		this.root = root ?? process.cwd();
	}

	run(): string {
		return 'video-evidence';
	}

	/** Select before opening any recorder; reuse retains the original record and revision. */
	plan(declaration: VideoDeclaration, previous: VideoSlot[] = []): VideoPlan {
		const manifest = videoClipSchema(declaration);
		if (!manifest.clips.length) return { record: [], reuse: [] };
		const context = createClipInputContext(this.root);
		const slots = manifest.clips.flatMap((clip) =>
			clip.viewports.map((viewport) => clipInputSlot(context, manifest, clip, viewport))
		);
		const record: VideoSlot[] = [],
			reuse: VideoSlot[] = [];
		for (const slot of slots) {
			const match = previous.find(
				(old) =>
					!slot.reasons?.some((reason) => reason.includes('recording required')) &&
					old.unit === slot.unit &&
					old.clipId === slot.clipId &&
					old.viewport === slot.viewport &&
					old.inputHash === slot.inputHash
			);
			if (match) reuse.push(match);
			else record.push(slot);
		}
		return { record, reuse };
	}

	/** Judge timestamped visits from already admitted, fresh clip evidence. */
	coverage(declaration: VideoDeclaration, observations: VideoObservation[]): VideoGraphCoverage[] {
		return graphCoverage(videoClipSchema(declaration), observations);
	}
}
