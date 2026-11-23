import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	unshownHostedArtifact,
	hostedAttestation
} from '../../src/utils/networking-security/hostedAttestation';
import { UnsupportedHostedMediaDeclarationError } from '../../src/utils/networking-security/hostedAttestation.types';

test('accepts supported hosted media declarations', () => {
	const image = hostedAttestation(' image/PNG ');
	const audio = hostedAttestation('audio/mpeg');
	const output = hostedAttestation(' application/json; charset=utf-8 ');

	expect(image).toEqual({ kind: 'screenshot', mediaType: 'image/png' });
	expect(audio).toEqual({ kind: 'audio', mediaType: 'audio/mpeg' });
	expect(output).toEqual({ kind: 'output', mediaType: 'application/json' });

	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-attestation',
			symbol: 'hostedAttestation',
			state: 'accepts-supported-hosted-media-declarations',
			evidence: 'examples-cases',
			file: 'accepts-supported-hosted-media-declarations.json'
		},
		[
			{ name: 'trim and normalize an image declaration', input: ' image/PNG ', output: image },
			{ name: 'classify MPEG audio', input: 'audio/mpeg', output: audio },
			{ name: 'accept UTF-8 JSON output', input: ' application/json; charset=utf-8 ', output }
		]
	);
});

test('rejects unsupported hosted media declarations', () => {
	let thrown: unknown;
	try {
		hostedAttestation('image/jpg');
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(UnsupportedHostedMediaDeclarationError);
	expect(thrown).toMatchObject({ message: unshownHostedArtifact });
	if (!(thrown instanceof Error)) throw new Error('Expected an unsupported declaration error.');

	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-attestation',
			symbol: 'hostedAttestation',
			state: 'rejects-unsupported-hosted-media-declarations',
			evidence: 'examples-cases',
			file: 'rejects-unsupported-hosted-media-declarations.json'
		},
		[
			{
				name: 'reject an unlisted image alias',
				input: 'image/jpg',
				error: { name: thrown.name, message: thrown.message }
			}
		]
	);
});
