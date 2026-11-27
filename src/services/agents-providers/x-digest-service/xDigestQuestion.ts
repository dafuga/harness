// @harness-uid u_abwrrjyfvg
import type { XBlock } from '../../../core/agents-providers/xDigest.types';

export function xDigestQuestion(problem: XBlock, viewerUrl: string): string {
	const what =
		problem === 'site-check'
			? 'X is asking to verify it is you'
			: 'the X container browser is not signed in';
	return (
		`X digest: ${what}. Open ${viewerUrl} on a device with Tailscale, ` +
		'then finish that step yourself in the browser shown.'
	);
}
