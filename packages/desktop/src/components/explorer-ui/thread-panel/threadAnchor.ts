import type { ThreadTarget, CommentAnchor } from '../../../utils/explorer-ui/threadAnchor';
import { optionImages, imageTarget, entityTarget } from '../../../utils/explorer-ui/threadAnchor';
import type { DesignVersion, Revision } from '../../../models/development-tooling/Desktop.types';

function sameHashes(left: string[], right: string[]): boolean {
	return left.length === right.length && left.every((sha) => right.includes(sha));
}

/**
 * Whether the design in view is the approved one: the current approval of the latest version
 * and, where the version has options, of exactly the option shown and its image hashes.
 */
export function shownApproval(
	design: DesignVersion | undefined,
	latest: string | null,
	option = ''
): boolean {
	if (!design?.approval?.current || design.version !== latest) return false;
	if (!design.options?.length) return true;
	const shown = optionImages(design, option).map((image) => image.sha256);
	return design.approval.option === option && sameHashes(shown, design.approval.imageHashes);
}

/** Whether a thread or a selection sits on another option of the version shown. */
export function otherOption(item: ThreadTarget | null, version: string, option: string) {
	return Boolean(item?.option && item.version === version && item.option !== option);
}

/** The first image of a design, of its shown option, or the entity when there is no image. */
export function designTarget(design: DesignVersion | undefined, option = ''): ThreadTarget {
	const image = optionImages(design, option)[0];
	return design && image ? imageTarget(design.version, image, null) : entityTarget;
}

/** A comment names the branch and commit that are viewed, also a historical one. */
export function threadAnchor(
	revision: Revision,
	entityId: string,
	target: ThreadTarget
): CommentAnchor {
	return {
		branch: revision.branch,
		commit: revision.commit,
		entityId,
		version: target.version,
		imageSha256: target.imageSha256,
		state: target.state,
		viewport: target.viewport,
		region: target.region
	};
}
