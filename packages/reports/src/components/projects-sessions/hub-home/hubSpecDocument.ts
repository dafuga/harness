// @harness-uid u_s53zhfyepg
import { getContext, setContext } from 'svelte';
import type { LoadSpecDocument } from '$reports/components/explorer-ui/explorer-kit/SpecDocumentView.types';

export const hubSpecDocumentKey = Symbol('hub-spec-document');

/** Home offers the signed-in owner's documents to the ask cards below it. */
export function provideHubSpecDocuments(load: LoadSpecDocument): void {
	setContext<LoadSpecDocument>(hubSpecDocumentKey, load);
}

export function hubSpecDocuments(): LoadSpecDocument {
	return getContext<LoadSpecDocument>(hubSpecDocumentKey);
}
