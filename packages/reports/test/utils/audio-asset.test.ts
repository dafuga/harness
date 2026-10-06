import { expect, test } from 'vitest';
import { audioAsset } from '../../src/utils/audioAsset';
import { audioFixture } from '../audioFixture';
test('validates WAV content and canonical extension before hashing', () => {
	const asset = audioAsset(audioFixture(2), 'Recording.WAV');
	expect(asset).toMatchObject({ mediaType: 'audio', mimeType: 'audio/wav', durationSeconds: 2 });
	expect(asset.name).toMatch(/^[a-f0-9]{64}\.wav$/);
	expect(() => audioAsset(audioFixture(), 'pretend.mp3')).toThrow(/match/);
});
test('rejects disguised, truncated, unsupported and oversized audio', () => {
	for (const name of ['fake.wav', 'fake.mp3', 'fake.m4a', 'fake.ogg'])
		expect(() => audioAsset(Buffer.from('<html>not audio</html>'), name)).toThrow();
	expect(() => audioAsset(audioFixture().subarray(0, 45), 'truncated.wav')).toThrow();
	expect(() => audioAsset(audioFixture(), 'sound.exe')).toThrow(/format/);
	expect(() => audioAsset(Buffer.alloc(50_000_001), 'large.wav')).toThrow(/size/);
});
