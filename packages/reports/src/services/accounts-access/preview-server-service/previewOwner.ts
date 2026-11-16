// @harness-uid u_6yzc5wxfxm
import type { PreviewOwner } from '../../../utils/accounts-access/previewOwner';
import { previewOwnerPath } from '../../../utils/accounts-access/previewOwner';
import { InvalidPreviewOwnerAddressError } from './InvalidPreviewOwnerAddressError';
import { PreviewOwnerIdentityMismatchError } from './PreviewOwnerIdentityMismatchError';
import { PreviewOwnerPortOccupiedError } from './PreviewOwnerPortOccupiedError';
import { PreviewOwnerStillStartingError } from './PreviewOwnerStillStartingError';

/** A bound slot is never assumed to be ours merely because it answers HTTP. */
export async function previewOwner(port: number, identity: string): Promise<string> {
	for (let attempt = 0; attempt < 100; attempt++) {
		const response = await fetch(`http://127.0.0.1:${port}${previewOwnerPath}`, {
			signal: AbortSignal.timeout(1000),
			redirect: 'error'
		});
		const text = await response.text();
		if (!response.ok || text.length > 2048)
			throw new PreviewOwnerPortOccupiedError(
				'Preview ownership port is occupied by another application.'
			);
		const owner = JSON.parse(text) as PreviewOwner;
		if (owner.protocol !== 'harness-preview-v1')
			throw new PreviewOwnerPortOccupiedError(
				'Preview ownership port is occupied by another application.'
			);
		if (owner.url !== null && !/^http:\/\/127\.0\.0\.1:\d+$/.test(owner.url))
			throw new InvalidPreviewOwnerAddressError('Invalid preview owner address.');
		if (owner.identity !== identity)
			throw new PreviewOwnerIdentityMismatchError(
				`A different Harness preview is already running at ${owner.url ?? 'startup'}. Close it before switching checkout or history data.`
			);
		if (owner.url) return owner.url;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	throw new PreviewOwnerStillStartingError(
		'The existing Harness preview is still starting; no duplicate was launched.'
	);
}
