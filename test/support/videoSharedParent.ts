import { videoReferenceFixture, reusedVideoParent, saveVideoParent } from './videoReferenceFixture';
import { VideoArchiveService } from '../../src/services/verification-evidence/VideoArchiveService';
import { EvidenceAttachService } from '../../src/services/verification-evidence/evidence-attach-service/EvidenceAttachService';
import { sealRecord } from '../../src/utils/verification-evidence/sealRecord';

export async function videoSharedParent(root: string, git: (...args: string[]) => string) {
	const f = await videoReferenceFixture(root, git, true);
	const descriptor = await new VideoArchiveService(root).describe(f.pointers[0]);
	const sibling = descriptor.batch.clips.find((clip) => clip.slot.clipId === 'sibling')!;
	const capture = {
		...f.capture,
		path: 'clips/sibling/clip.mp4',
		video: sibling.video,
		sha256: sibling.media.sha256,
		bytes: sibling.media.bytes
	};
	const { id, ...draft } = f.record;
	void id;
	const parent = sealRecord({
		...draft,
		scenarios: [
			{
				...draft.scenarios[0],
				states: [{ ...draft.scenarios[0].states[0], captures: [f.capture, capture] }]
			}
		]
	});
	await new EvidenceAttachService(root).attach(
		parent.source.commit,
		await saveVideoParent(root, parent)
	);
	const child = await reusedVideoParent(root, git, parent);
	const captures = [
		child.capture,
		{
			...capture,
			videoReference: {
				batch: f.pointers[0].batch,
				record: parent.id,
				revision: parent.source.commit
			}
		}
	];
	return { ...f, parent, child, captures };
}
