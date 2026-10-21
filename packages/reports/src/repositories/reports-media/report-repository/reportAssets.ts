import { imageAsset, writeImageAsset } from '../../../utils/reports-media/reportAssets';
import { lstat, readFile } from 'node:fs/promises';
import { audioAsset } from '../../../utils/reports-media/audio-asset/audioAsset';
import { mediaMime } from '../../../utils/verification-evidence/evidenceMedia';

export async function reportAssets(directory: string, source: string) {
	const info = await lstat(source);
	if (info.isSymbolicLink()) throw new Error('Evidence symlinks are not accepted');
	if (!info.isFile() || info.size > 50_000_000) throw new Error('Invalid evidence file or size');
	const bytes = await readFile(source);
	const asset = mediaMime(source).startsWith('audio/')
		? audioAsset(bytes, source)
		: {
				name: imageAsset(bytes, source).name,
				mediaType: 'image' as const,
				mimeType: mediaMime(source)
			};
	await writeImageAsset(directory, asset.name, bytes);
	return asset;
}
