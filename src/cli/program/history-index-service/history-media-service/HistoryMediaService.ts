import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { mediaPlace } from './mediaPlace';
import { type MediaFile, type MediaPlacer } from '../../../../utils/mediaPlace';
import type { ResolvedMedia } from '../../../../utils/recordView';

/**
 * Writes original evidence bytes into the output, named by their hash. Bytes that are missing,
 * or that are not the bytes the record names, become a stated gap; nothing stands in for them.
 */
export class HistoryMediaService implements MediaPlacer {
	readonly counts = { resolved: 0, missing: 0 };
	private readonly written = new Set<string>();

	constructor(private readonly out: string) {}

	async place(bytes: Buffer | undefined, file: MediaFile, gap: string): Promise<ResolvedMedia> {
		const placed = mediaPlace(bytes, file, gap);
		if (!bytes || placed.media === null) {
			this.counts.missing += 1;
			return placed;
		}
		if (!this.written.has(placed.media)) {
			await mkdir(dirname(join(this.out, placed.media)), { recursive: true });
			await writeFile(join(this.out, placed.media), bytes);
			this.written.add(placed.media);
		}
		this.counts.resolved += 1;
		return placed;
	}
}
