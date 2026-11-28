// @harness-uid u_xvqh2cedmn
import { collectTrackerAttachments } from '../../../services/projects-sessions/tracker-ask-attachments/collectTrackerAttachments';
import type { TrackerAttachmentWords } from '../../../services/projects-sessions/tracker-ask-attachments/collectTrackerAttachments.types';
import type { nativeTrackerArgs } from './nativeTrackerRequest';

/** Read the documents a flag names before it is sent, on the computer that raised it. */
export async function withTrackerAttachments(
	input: ReturnType<typeof nativeTrackerArgs>
): Promise<ReturnType<typeof nativeTrackerArgs>> {
	const { spec, doc, design } = input.values as TrackerAttachmentWords;
	if (!['flag', 'release'].includes(input.command) || !(spec || doc || design)) return input;
	const attachments = await collectTrackerAttachments({ spec, doc, design });
	const body = { ...(input.request.body as Record<string, unknown>), attachments };
	return { ...input, request: { ...input.request, body } };
}
