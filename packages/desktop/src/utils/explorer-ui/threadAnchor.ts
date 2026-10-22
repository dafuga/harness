import type {
	DesignImage,
	DesignVersion,
	ThreadInfo
} from '../../models/development-tooling/Desktop.types';
import type { HumanCommentDraft } from '../../models/projects-sessions/ProjectContext.types';

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

export {
	shownApproval,
	otherOption,
	designTarget,
	threadAnchor
} from '../../components/explorer-ui/thread-panel/threadAnchor';
export { versionOption } from '../../components/explorer-ui/entity-view/threadAnchor';
export { sameImage } from '../../components/explorer-ui/thread-links/threadAnchor';
