// @harness-uid u_s53zhfyepg
import { getContext, setContext } from 'svelte';
import type { TrackerAttachmentDocument } from '../../../../../src/utils/projects-sessions/trackerAttachment.types';
import type { LoadSpecDocument } from '$reports/components/explorer-ui/explorer-kit/SpecDocumentView.types';
import type { BrowserApi } from '../../utils/browserApi';

export const hubSpecDocumentKey = Symbol('hub-spec-document');

/** Home offers the signed-in owner's documents to the ask cards below it. */
export function provideHubSpecDocuments(api: BrowserApi): void {
	setContext<LoadSpecDocument>(hubSpecDocumentKey, (attachment) =>
		api.get<TrackerAttachmentDocument>('/api/hub-home/doc', { id: attachment.id })
	);
}

export function hubSpecDocuments(): LoadSpecDocument {
	return getContext<LoadSpecDocument>(hubSpecDocumentKey);
}
