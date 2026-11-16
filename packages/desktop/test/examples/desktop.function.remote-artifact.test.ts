import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { remoteArtifact } from '../../src/lib/verification-evidence/select-environment/capacitor-bridge-adapter/remoteArtifact';
import { ArtifactRefusedError } from '../../src/lib/verification-evidence/select-environment/capacitor-bridge-adapter/remoteArtifact.types';
import {
	artifactLimit,
	unshownArtifact,
	largeArtifact,
	otherArtifact
} from '../../src/utils/verification-evidence/remoteArtifact';

const abcHash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const abc = {
	encoding: 'base64' as const,
	mediaType: 'text/plain; charset=utf-8',
	byteLength: 3,
	sha256: abcHash,
	data: 'YWJj'
};

test('accepts supported bytes matching the requested hash', async () => {
	const result = await remoteArtifact(abc, abcHash);
	expect([...result.bytes]).toEqual([97, 98, 99]);
	expect(result).toMatchObject({ mediaType: abc.mediaType, sha256: abcHash });

	recordExampleCases(
		{
			unitId: 'desktop.function.remote-artifact',
			symbol: 'remoteArtifact',
			state: 'accepts-supported-bytes-matching-the-requested-hash',
			evidence: 'examples-cases',
			file: 'accepts-supported-bytes-matching-the-requested-hash.json'
		},
		[
			{
				name: 'decode the requested plain text artifact',
				input: { value: abc, asked: abcHash },
				output: { bytes: [97, 98, 99], mediaType: abc.mediaType, sha256: abcHash }
			}
		]
	);
});

test('refuses unsupported or oversized artifacts', async () => {
	const cases = [
		{ name: 'refuse markup media', value: { ...abc, mediaType: 'text/html' }, message: unshownArtifact },
		{ name: 'refuse a file above the size limit', value: { ...abc, byteLength: artifactLimit + 1 }, message: largeArtifact }
	];
	const recorded: Array<{ name: string; input: unknown; error: { name: string; message: string } }> = [];
	for (const item of cases) {
		let thrown: unknown;
		try {
			await remoteArtifact(item.value, abcHash);
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(ArtifactRefusedError);
		expect(thrown).toMatchObject({ message: item.message });
		if (!(thrown instanceof Error)) throw new Error('Expected artifact refusal.');
		recorded.push({ name: item.name, input: { value: item.value, asked: abcHash }, error: { name: thrown.name, message: thrown.message } });
	}
	recordExampleCases(
		{
			unitId: 'desktop.function.remote-artifact',
			symbol: 'remoteArtifact',
			state: 'refuses-unsupported-or-oversized-artifacts',
			evidence: 'examples-cases',
			file: 'refuses-unsupported-or-oversized-artifacts.json'
		},
		recorded
	);
});

test('refuses artifacts whose hash was not requested', async () => {
	let thrown: unknown;
	try {
		await remoteArtifact(abc, undefined);
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBeInstanceOf(ArtifactRefusedError);
	expect(thrown).toMatchObject({ message: otherArtifact });
	if (!(thrown instanceof Error)) throw new Error('Expected artifact refusal.');

	recordExampleCases(
		{
			unitId: 'desktop.function.remote-artifact',
			symbol: 'remoteArtifact',
			state: 'refuses-artifacts-whose-hash-was-not-requested',
			evidence: 'examples-cases',
			file: 'refuses-artifacts-whose-hash-was-not-requested.json'
		},
		[
			{
				name: 'refuse when no hash was requested',
				input: { value: abc, asked: undefined },
				error: { name: thrown.name, message: thrown.message }
			}
		]
	);
});
