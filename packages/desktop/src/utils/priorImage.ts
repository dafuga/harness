import type { DesignImage, DesignVersion } from '../models/Desktop.types';

export interface PriorImage {
	version: string;
	sha256: string;
}

/**
 * The committed image a commit replaced. There is one only in a commit view, when that commit
 * introduced the shown version and the version before it holds an image of the same viewport
 * and state. A branch view has no commit to compare and shows its one current image.
 */
export function priorImage(
	versions: DesignVersion[],
	shown: { version: string; image: DesignImage | undefined },
	commit: string | null
): PriorImage | null {
	const index = versions.findIndex((item) => item.version === shown.version);
	const image = shown.image;
	if (!commit || !image || versions[index]?.commit !== commit) return null;
	const prior = versions[index - 1];
	const before = prior?.images.find(
		(item) => item.viewport === image.viewport && item.state === image.state
	);
	return before ? { version: prior.version, sha256: before.sha256 } : null;
}
