import type { LoadSpecDocument } from '$reports/components/explorer-ui/explorer-kit/SpecDocumentView.types';

/** The signed-in owner's Hub holds the documents of the open asks. */
export const loadHubSpecDocument: LoadSpecDocument = async (attachment) => {
	const response = await fetch(`/api/hub-home/doc?id=${attachment.id}`, { cache: 'no-store' });
	return response.ok ? await response.json() : null;
};
