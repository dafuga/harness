import { PriorImage } from '../../utils/priorImage';
import type { DesignImage, DesignVersion } from "../../models/Desktop.types.ts";

/**
 * The committed image a commit replaced. There is one only in a commit view, when that commit
 * introduced the shown version: the exact image it revises, or for a single design without that
 * record, the image of the same viewport and state of the version before. A branch view has no
 * commit to compare and shows its one current image.
 */
export function priorImage(
	versions: DesignVersion[],
	shown: { version: string; image: DesignImage | undefined },
	commit: string | null
): PriorImage | null {
	const index = versions.findIndex((item) => item.version === shown.version);
	const image = shown.image;
	const version = versions[index];
	if (!commit || !image || version?.commit !== commit) return null;
	// The exact image a version revises is its before; options of two versions never pair by order.
	if (version.revises)
		return { version: version.revises.version, sha256: version.revises.imageSha256 };
	if (version.options?.length) return null;
	const prior = versions[index - 1];
	const before = prior?.images.find(
		(item) => item.viewport === image.viewport && item.state === image.state
	);
	return before ? { version: prior.version, sha256: before.sha256 } : null;
}
