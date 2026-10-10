const header = 'version https://git-lfs.github.com/spec/v1';
/** Media is stored through Git LFS; records, manifests, logs and text stay ordinary blobs. */
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

/** Reads a pointer; anything else, including real media, is not one. */
export function parseLfsPointer(text: string): LfsObject | undefined {
	const match = /^version \S+\noid sha256:([0-9a-f]{64})\nsize (\d+)\n?$/.exec(text);
	return match ? { sha256: match[1], bytes: Number(match[2]) } : undefined;
}

/** True for files that go through LFS, decided by extension so it matches `.gitattributes`. */
export function lfsStored(path: string): boolean {
	const extension = /\.([a-z0-9]+)$/i.exec(path)?.[1].toLowerCase() ?? '';
	return mediaExtensions.includes(extension);
}

/** The `.gitattributes` of the evidence branch, so ordinary LFS clients see the same files. */
export function lfsAttributes(): string {
	const rules = mediaExtensions.flatMap((extension) => [extension, extension.toUpperCase()]);
	return rules.map((extension) => `*.${extension} filter=lfs diff=lfs merge=lfs -text\n`).join('');
}
