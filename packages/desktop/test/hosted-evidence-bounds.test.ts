import { expect, test } from 'vitest';
import { hostedResponse } from '../src/utils/hostedResponse';
import { hostedArtifact } from '../src/utils/hostedArtifact';
import { HostedEvidenceValidator } from '../src/validators/HostedEvidenceValidator';
import { asked, hubAnswer } from './hosted-evidence-fixture';

test('a chunked response without Content-Length stops once its limit is exceeded', async () => {
	let cancelled = false;
	const response = new Response(
		new ReadableStream({
			pull(controller) {
				controller.enqueue(new Uint8Array(9));
			},
			cancel() {
				cancelled = true;
			}
		})
	);
	await expect(hostedResponse(response, 16)).rejects.toThrow('exceeds');
	expect(cancelled).toBe(true);
});
test('the exact byte limit is allowed and missing body is empty', async () => {
	expect(await hostedResponse(new Response(new Uint8Array(16)), 16)).toHaveLength(16);
	expect(await hostedResponse(new Response(null), 16)).toHaveLength(0);
});
test('a reply bound to another selected branch is rejected', () => {
	const value = hubAnswer();
	value.identity.requestedRef = 'other';
	expect(() => new HostedEvidenceValidator().evidence(value, asked)).toThrow(
		'another evidence read'
	);
});
test('supported but mismatched image MIME is refused', async () => {
	const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	const sha256 = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join(
		''
	);
	await expect(hostedArtifact({ bytes, mediaType: 'image/jpeg' }, sha256)).rejects.toThrow(
		'does not show'
	);
});
