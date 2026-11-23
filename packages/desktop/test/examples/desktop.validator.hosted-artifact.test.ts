import { createHash } from 'node:crypto';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { HostedArtifactValidator } from '../../src/validators/development-tooling/HostedArtifactValidator';
import { HostedArtifactRejectedError } from '../../src/validators/development-tooling/HostedArtifactValidator.types';

const validator = new HostedArtifactValidator();
const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const textBytes = new TextEncoder().encode('{"ok":true}');

function digest(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function rejection(media: { bytes: Uint8Array; mediaType: string }, sha256: string) {
	try {
		validator.artifact(media, sha256);
	} catch (error) {
		return error;
	}
	throw new Error('Expected the hosted artifact to be rejected.');
}

test('serves attested screenshot and text artifacts', () => {
	const image = validator.artifact({ bytes: pngBytes, mediaType: 'image/png' }, digest(pngBytes));
	const text = validator.artifact(
		{ bytes: textBytes, mediaType: 'application/json' },
		digest(textBytes)
	);
	expect(image).toMatchObject({ mediaType: 'image/png', sha256: digest(pngBytes) });
	expect(text).toMatchObject({ mediaType: 'application/json', sha256: digest(textBytes) });
	recordExampleCases(
		{
			unitId: 'desktop.validator.hosted-artifact',
			symbol: 'HostedArtifactValidator.artifact',
			state: 'serves-attested-screenshot-and-text-artifacts',
			evidence: 'examples-cases',
			file: 'serves-attested-screenshot-and-text-artifacts.json'
		},
		[
			{
				name: 'serve PNG screenshot',
				input: { mediaType: 'image/png', sha256: digest(pngBytes) },
				output: { mediaType: image.mediaType, sha256: image.sha256, byteLength: image.bytes.length }
			},
			{
				name: 'serve JSON result',
				input: { mediaType: 'application/json', sha256: digest(textBytes) },
				output: { mediaType: text.mediaType, sha256: text.sha256, byteLength: text.bytes.length }
			}
		]
	);
});

test('rejects artifacts with invalid digests or unsupported kinds', () => {
	const badDigest = rejection({ bytes: pngBytes, mediaType: 'image/png' }, 'bad');
	const badKind = rejection({ bytes: textBytes, mediaType: 'text/html' }, digest(textBytes));
	expect(badDigest).toBeInstanceOf(HostedArtifactRejectedError);
	expect(badKind).toMatchObject({
		message: 'The hosted service sent a kind this app does not show.'
	});
	if (!(badDigest instanceof Error) || !(badKind instanceof Error))
		throw new Error('Expected errors.');
	recordExampleCases(
		{
			unitId: 'desktop.validator.hosted-artifact',
			symbol: 'HostedArtifactValidator.artifact',
			state: 'rejects-artifacts-with-invalid-digests-or-unsupported-kinds',
			evidence: 'examples-cases',
			file: 'rejects-artifacts-with-invalid-digests-or-unsupported-kinds.json'
		},
		[
			{
				name: 'reject malformed digest',
				input: { mediaType: 'image/png', sha256: 'bad' },
				error: { name: badDigest.name, message: badDigest.message }
			},
			{
				name: 'reject unsupported HTML declaration',
				input: { mediaType: 'text/html', sha256: digest(textBytes) },
				error: { name: badKind.name, message: badKind.message }
			}
		]
	);
});
