import type { DesignImage, DesignVersion, Revision, ThreadInfo } from '../models/Desktop.types';
import type { HumanCommentDraft } from '../models/ProjectContext.types';

/** Where on an entity a thread sits: an exact image and region, or the entity itself. */
export type ThreadTarget = Pick<
	ThreadInfo,
	'version' | 'imageSha256' | 'state' | 'viewport' | 'region'
>;
export type CommentAnchor = HumanCommentDraft['anchor'];

export const entityTarget: ThreadTarget = {
	version: null,
	imageSha256: null,
	state: null,
	viewport: null,
	region: null
};

export function imageTarget(
	version: string,
	image: DesignImage,
	region: ThreadTarget['region']
): ThreadTarget {
	return {
		version,
		imageSha256: image.sha256,
		state: image.state,
		viewport: image.viewport,
		region
	};
}

/** The first image of a design, or the entity when the design has none: no image is invented. */
export function designTarget(design: DesignVersion | undefined): ThreadTarget {
	const image = design?.images[0];
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

export function sameImage(left: ThreadTarget | null, right: ThreadTarget): boolean {
	return Boolean(
		left?.imageSha256 && left.imageSha256 === right.imageSha256 && left.version === right.version
	);
}
