// @harness-uid u_s53zhfyepg
import { getContext, setContext } from 'svelte';
import type { LoadSpecDocument } from '$reports/components/explorer-ui/explorer-kit/SpecDocumentView.types';

const loader = Symbol('hub-spec-document');

/** Shares the host's approved document loader with the ask cards below it. */
export function provideHubSpecDocuments(load: LoadSpecDocument): void {
	setContext<LoadSpecDocument>(loader, load);
}

export function hubSpecDocuments(): LoadSpecDocument {
	return getContext<LoadSpecDocument>(loader);
}
