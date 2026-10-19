import { LfsObject } from '../../utils/lfsPointer';


/** Reads a pointer; anything else, including real media, is not one. */
export function parseLfsPointer(text: string): LfsObject | undefined {
	const match = /^version \S+\noid sha256:([0-9a-f]{64})\nsize (\d+)\n?$/.exec(text);
	return match ? { sha256: match[1], bytes: Number(match[2]) } : undefined;
}
