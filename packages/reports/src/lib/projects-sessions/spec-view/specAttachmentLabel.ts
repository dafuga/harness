import type { TrackerAttachment } from '../../../../../../src/utils/projects-sessions/trackerAttachment.types';

/** The button's quiet second part: the file, and the pull request it came from. */
export function specAttachmentDetail(attachment: TrackerAttachment): string {
	return [attachment.title, attachment.pr ? `PR ${attachment.pr}` : ''].filter(Boolean).join(' · ');
}

export function specAttachmentAction(attachment: TrackerAttachment): string {
	if (attachment.kind === 'design') return 'View design';
	return attachment.kind === 'spec' ? 'View spec' : 'View document';
}

/** Where the same text can be opened on GitHub, at the commit that was copied. */
export function specAttachmentSource(attachment: TrackerAttachment): string | null {
	if (attachment.url) return attachment.url;
	const { repo, ref, path } = attachment;
	return repo && ref && path ? `https://github.com/${repo}/blob/${ref}/${encodeURI(path)}` : null;
}
