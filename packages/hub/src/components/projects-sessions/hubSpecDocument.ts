// @harness-uid u_s53zhfyepg
import type { TrackerAttachment } from '../../../../../src/utils/projects-sessions/trackerAttachment.types';
import type { LoadSpecDocument } from '$reports/components/explorer-ui/explorer-kit/SpecDocumentView.types';

/** The signed-in owner's Hub holds the documents of the open asks. */
export const loadHubSpecDocument: LoadSpecDocument = async (attachment: TrackerAttachment) => {
	const response = await fetch(`/api/hub-home/doc?id=${attachment.id}`, { cache: 'no-store' });
	return response.ok ? await response.json() : null;
};
