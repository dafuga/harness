import type { DesignImage, DesignVersion, Revision, ThreadInfo } from '../models/Desktop.types';
import type { HumanCommentDraft } from '../models/ProjectContext.types';

/** Where on an entity a thread sits: an exact image and region, or the entity itself. */
export type ThreadTarget = Pick<
	ThreadInfo,
	'version' | 'imageSha256' | 'state' | 'viewport' | 'region' | 'option'
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
		region,
		...(image.option ? { option: image.option } : {})
	};
}

/**
 * The images of one design option of a version, or all of a version that has no options. An
 * option is its exact images: the flat images that name it.
 */
export function optionImages(design: DesignVersion | undefined, option: string): DesignImage[] {
	if (!design?.options?.length) return design?.images ?? [];
	return design.images.filter((image) => image.option === option);
}

/** The option the current approval of a version names, if it names one. */
function approvedOption(design: DesignVersion | undefined): string | undefined {
	return design?.approval?.current ? design.approval.option : undefined;
}

/**
 * The option to show of a version: the one wanted when the version holds it, else the option
 * the current approval names, else the first. A version without options shows no option.
 */
export function designOption(design: DesignVersion | undefined, wanted = ''): string {
	const ids = (design?.options ?? []).map((item) => item.id);
	if (ids.includes(wanted) || !ids.length) return ids.length ? wanted : '';
	const approved = approvedOption(design);
	return approved && ids.includes(approved) ? approved : ids[0];
}

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

/** The option to show of the version named among an entity's versions. */
export function versionOption(versions: DesignVersion[], version: string, wanted = ''): string {
	return designOption(
		versions.find((item) => item.version === version),
		wanted
	);
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

export function sameImage(left: ThreadTarget | null, right: ThreadTarget): boolean {
	return Boolean(
		left?.imageSha256 && left.imageSha256 === right.imageSha256 && left.version === right.version
	);
}
