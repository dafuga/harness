import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import type { EvidenceArtifactQuery } from '../../src/models/verification-evidence/DesktopEvidence.types';
import { artifactBytes } from '../../src/components/shared-primitives/recorded-preview/artifactBytes';
import {
	artifactBytes as relocatedArtifactBytes,
	damagedArtifact,
	unreadArtifact
} from '../../src/utils/shared-primitives/artifactBytes';

const bytes = new TextEncoder().encode('recorded');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const query = { sha256 } as EvidenceArtifactQuery;

test('bytes that have the recorded hash are given as they are', async () => {
	const bridge = { artifact: async () => ({ bytes, mediaType: 'text/plain', sha256 }) };
	expect(await artifactBytes(bridge, query)).toEqual({ bytes, mediaType: 'text/plain', sha256 });
});

test('bytes with another hash are refused, though the answer states the recorded one', async () => {
	const other = new TextEncoder().encode('something else');
	const bridge = { artifact: async () => ({ bytes: other, mediaType: 'text/plain', sha256 }) };
	await expect(artifactBytes(bridge, query)).rejects.toThrow(damagedArtifact);
});

test('a bridge without the read says so, and a refusal keeps the words of the backend', async () => {
	await expect(artifactBytes({}, query)).rejects.toThrow(unreadArtifact);
	const refused = {
		artifact: async () => {
			throw new Error('This capture is not part of the selected record.');
		}
	};
	await expect(artifactBytes(refused, query)).rejects.toThrow(/not part of the selected record/);
});

test('the relocated path names the same artifactBytes as the recorded preview', () => {
	expect(relocatedArtifactBytes).toBe(artifactBytes);
});
