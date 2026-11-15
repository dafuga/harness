// @harness-uid u_qfigvyo5j5
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { EvidenceBranchRepository } from '../../repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { LfsAdapter } from '../../adapters/git-source-history/LfsAdapter';
import { evidenceRef } from '../../core/git-source-history/historyTypes';
import { writeVideoBatches } from './video-archive-service/write';
import { readVideoBatch } from './video-archive-service/read';
import { restoreVideoBatch } from './video-archive-service/restore';
import { hashSchema, pointerSchema, slotSchema } from './video-archive-service/schema';
import { slotKey } from './video-archive-service/batch';
import type {
	VideoArchiveCurrent,
	VideoArchiveInput,
	VideoArchiveRead,
	VideoArchiveSlot,
	VideoBatchPointer
} from './VideoArchiveService.types';

/** Custom archive evidence preserves admitted bytes and provenance, never a full verification verdict. */
export class VideoArchiveService {
	constructor(private readonly root: string = process.cwd()) {}

	run(): string {
		return 'video-archive';
	}

	async write(inputs: VideoArchiveInput[]): Promise<VideoBatchPointer[]> {
		const pointers = await writeVideoBatches(this.root, inputs);
		for (const pointer of pointers) await this.read(pointer);
		return pointers;
	}

	read(pointer: VideoBatchPointer, within?: string): Promise<VideoArchiveRead> {
		return readVideoBatch(this.root, pointer, within);
	}

	/** Caller supplies trusted parent-linked pointers; archive integrity alone grants no parent standing. */
	async current(
		slot: VideoArchiveSlot,
		inputHash: string,
		pointers: VideoBatchPointer[],
		within?: string
	): Promise<VideoArchiveCurrent | null> {
		const key = slotKey(slotSchema.parse(slot));
		hashSchema.parse(inputHash);
		try {
			for (const pointer of [...pointers].reverse()) {
				const read = await this.read(pointer, within);
				const clip = read.batch.clips.find(
					(item) => slotKey(item.slot) === key && item.video.inputHash === inputHash
				);
				if (clip) return { pointer: read.pointer, clip, files: read.files };
			}
			return null;
		} catch {
			return null;
		}
	}

	async restore(
		pointer: VideoBatchPointer,
		directory: string,
		within?: string
	): Promise<VideoArchiveRead> {
		const read = await this.read(pointer, within);
		await restoreVideoBatch(read, directory, this.root);
		return read;
	}

	/** Explicit transport only; ordinary readers never contact a remote or advance the evidence branch. */
	async fetch(input: VideoBatchPointer, remote: string): Promise<VideoArchiveRead> {
		const pointer = pointerSchema.parse(input),
			tree = new EvidenceBranchRepository(this.root).tree;
		if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(remote))
			throw new ExpectedCliError('Use a configured Git remote name.');
		await tree.git.run(['fetch', '--no-tags', '--', remote, evidenceRef]);
		const tip = await tree.git.run(['rev-parse', 'FETCH_HEAD^{commit}']);
		if (!(await tree.contains(tip, pointer.evidence.commit)))
			throw new ExpectedCliError('Fetched evidence ancestry does not contain the video batch.');
		const error = await new LfsAdapter(this.root).fetch(remote, pointer.evidence.commit);
		if (error) throw new ExpectedCliError(`Video archive LFS fetch failed: ${error}`);
		return this.read(pointer, tip);
	}
}

export type {
	VideoArchiveBatch,
	VideoArchiveClip,
	VideoArchiveCurrent,
	VideoArchiveInput,
	VideoArchiveRead,
	VideoArchiveSlot,
	VideoBatchPointer
} from './VideoArchiveService.types';
