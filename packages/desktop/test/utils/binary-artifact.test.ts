import { expect, test } from 'vitest';
import { binaryAnswer } from '../../src/utils/binaryAnswer';
import { binaryArtifact } from '../../src/utils/binaryArtifact';
import { damagedMedia, unreadableMedia } from '../../src/utils/remoteBinary';

const bytes = new TextEncoder().encode('{"steps":["opened","saved"]}');

test('an artifact that crossed a transport is its bytes, its media type and its hash again', async () => {
	const sent = binaryAnswer(bytes, 'application/json');
	const artifact = await binaryArtifact(sent);
	expect(artifact).toEqual({ bytes, mediaType: 'application/json', sha256: sent.sha256 });
	expect(artifact.bytes).toBeInstanceOf(Uint8Array);
});

test('bytes that are not what was sent are refused, whatever the answer says of itself', async () => {
	const sent = binaryAnswer(bytes, 'image/png');
	const other = binaryAnswer(new TextEncoder().encode('other'), 'image/png');
	await expect(binaryArtifact({ ...sent, data: other.data })).rejects.toThrow(damagedMedia);
	await expect(binaryArtifact({ ...sent, sha256: other.sha256 })).rejects.toThrow(damagedMedia);
	await expect(binaryArtifact({ ...sent, encoding: 'hex' as never })).rejects.toThrow(
		unreadableMedia
	);
	await expect(binaryArtifact({ ...sent, mediaType: 5 as never })).rejects.toThrow(unreadableMedia);
});
