const header = 'version https://git-lfs.github.com/spec/v1';

export /** Media is stored through Git LFS; records, manifests, logs and text stay ordinary blobs. */
const mediaExtensions = [
	'png',
	'jpg',
	'jpeg',
	'webp',
	'gif',
	'wav',
	'mp3',
	'm4a',
	'ogg',
	'webm',
	'mp4'
];

export interface LfsObject {
	/** sha256 of the original bytes, which is also the LFS object id. */
	sha256: string;
	bytes: number;
}

/** The exact pointer text Git LFS reads in place of the original bytes. */
export function lfsPointer(file: LfsObject): string {
	return `${header}\noid sha256:${file.sha256}\nsize ${file.bytes}\n`;
}

/** True for files that go through LFS, decided by extension so it matches `.gitattributes`. */
export function lfsStored(path: string): boolean {
	const extension = /\.([a-z0-9]+)$/i.exec(path)?.[1].toLowerCase() ?? '';
	return mediaExtensions.includes(extension);
}

export { parseLfsPointer } from '../services/history-status-service/attached-record-service/lfsPointer';
export { lfsAttributes } from '../repositories/evidence-branch-repository/lfsPointer';
