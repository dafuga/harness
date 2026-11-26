// @harness-uid u_77xldqp546
import { trackerAttachmentLimits as limits } from '../../../utils/projects-sessions/trackerAttachmentLimits';
import {
	trackerMarkdownImages,
	trackerRepositoryImage
} from '../../../utils/projects-sessions/trackerMarkdownImages';
import type { TrackerAttachmentDocument } from '../../../utils/projects-sessions/trackerAttachment.types';
import type { TrackerAttachmentSource } from '../../../utils/projects-sessions/parseTrackerAttachmentWord.types';
import type { TrackerAttachmentReader } from './githubAttachmentReader.types';

/** The file and its repository images as they are at one commit, so later pushes change nothing. */
export async function snapshotRepositoryDocument(
	source: TrackerAttachmentSource & { ref: string },
	reader: TrackerAttachmentReader
): Promise<TrackerAttachmentDocument> {
	const markdown = (await reader.file(source.repo, source.path, source.ref)).toString('utf8');
	const images: Record<string, string> = {};
	let room = limits.documentBytes - Buffer.byteLength(markdown);
	for (const name of trackerMarkdownImages(markdown)) {
		const image = trackerRepositoryImage(source.path, name);
		if (!image || name.length > 400) continue;
		const bytes = await reader.file(source.repo, image.path, source.ref).catch(() => null);
		if (!bytes) continue;
		const address = `data:${image.type};base64,${bytes.toString('base64')}`;
		// An image that does not fit is left out; the modal names it and links the pull request.
		if (address.length > Math.min(limits.imageChars, room)) continue;
		images[name] = address;
		room -= address.length;
	}
	return { markdown, ...(Object.keys(images).length && { images }) };
}
