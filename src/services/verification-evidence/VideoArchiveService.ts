// @harness-uid u_qfigvyo5j5
import { writeVideoBatches } from './video-archive-service/write';
import { readVideoBatch } from './video-archive-service/read';
import { restoreVideoBatch } from './video-archive-service/restore';
import { fetchVideoBatch } from './video-archive-service/fetch';
import { hashSchema, slotSchema } from './video-archive-service/schema';
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
	fetch(input: VideoBatchPointer, remote: string): Promise<VideoArchiveRead> {
		return fetchVideoBatch(this.root, input, remote);
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
