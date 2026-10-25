import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import manifest from '../../../../test/fixtures/contract-migration/wav-info-examples.json' with { type: 'json' };
import { wavInfo as audioAssetWavInfo } from '../../src/utils/audio-asset/wavInfo';
import { wavInfo as mediaWavInfo } from '../../src/utils/reports-media/audio-asset/wavInfo';
import { wavInfo as utilityWavInfo } from '../../src/utils/wavInfo';
import { audioFixture } from '../audioFixture';

type Metadata = {
	encoding: number;
	channels: number;
	sampleRate: number;
	bytesPerSecond: number;
	blockAlign: number;
	bitsPerSample: number;
	dataBytes: number;
};
type Fixture = {
	$fixture?: string;
	sampleRate?: number;
	metadata?: Metadata;
	matrix?: Metadata[];
} | null;

function riff(chunks: Array<{ id: string; data: Buffer }>): Buffer {
	const length =
		12 + chunks.reduce((total, chunk) => total + 8 + chunk.data.length + (chunk.data.length % 2), 0);
	const bytes = Buffer.alloc(length);
	bytes.write('RIFF');
	bytes.writeUInt32LE(length - 8, 4);
	bytes.write('WAVE', 8);
	let offset = 12;
	for (const chunk of chunks) {
		bytes.write(chunk.id, offset);
		bytes.writeUInt32LE(chunk.data.length, offset + 4);
		chunk.data.copy(bytes, offset + 8);
		offset += 8 + chunk.data.length + (chunk.data.length % 2);
	}
	return bytes;
}

function metadataWav(metadata: Metadata): Buffer {
	const format = Buffer.alloc(16);
	format.writeUInt16LE(metadata.encoding, 0);
	format.writeUInt16LE(metadata.channels, 2);
	format.writeUInt32LE(metadata.sampleRate, 4);
	format.writeUInt32LE(metadata.bytesPerSecond, 8);
	format.writeUInt16LE(metadata.blockAlign, 12);
	format.writeUInt16LE(metadata.bitsPerSample, 14);
	return riff([
		{ id: 'fmt ', data: format },
		{ id: 'data', data: Buffer.alloc(metadata.dataBytes) }
	]);
}

function withJunk(wave: Buffer): Buffer {
	const junk = Buffer.alloc(12);
	junk.write('JUNK');
	junk.writeUInt32LE(4, 4);
	const extra = Buffer.concat([wave.subarray(0, 12), junk, wave.subarray(12)]);
	extra.writeUInt32LE(extra.length - 8, 4);
	return extra;
}

function malformedChunk(kind: 'truncated' | 'boundary'): Buffer {
	const wave = metadataWav({
		encoding: 1,
		channels: 1,
		sampleRate: 16000,
		bytesPerSecond: 32000,
		blockAlign: 2,
		bitsPerSample: 16,
		dataBytes: 1
	});
	if (kind === 'truncated') {
		wave.writeUInt32LE(4, 40);
		return wave;
	}
	const boundary = Buffer.from(wave.subarray(0, wave.length - 1));
	boundary.writeUInt32LE(boundary.length - 8, 4);
	return boundary;
}

function audioBytes(fixture: Fixture): Buffer {
	const bytes = audioFixture();
	if (fixture?.sampleRate !== undefined) bytes.writeUInt32LE(fixture.sampleRate, 24);
	return bytes;
}

function chunkBytes(kind: string): Buffer {
	if (kind === 'missing-format')
		return riff([
			{ id: 'JUNK', data: Buffer.alloc(4) },
			{ id: 'data', data: Buffer.alloc(16) }
		]);
	if (kind === 'invalid-format')
		return riff([
			{ id: 'fmt ', data: Buffer.alloc(8) },
			{ id: 'data', data: Buffer.alloc(16) }
		]);
	return malformedChunk(kind as 'truncated' | 'boundary');
}

function formatBytes(kind: string): Buffer {
	const metadata: Metadata = {
		encoding: kind === 'unsupported-encoding' ? 2 : 1,
		channels: 1,
		sampleRate: 16000,
		bytesPerSecond: kind === 'invalid-sample' ? 1 : 32000,
		blockAlign: 2,
		bitsPerSample: 16,
		dataBytes: kind === 'invalid-data' ? 1 : 2
	};
	return metadataWav(metadata);
}

function fixtureBytes(fixture: Fixture): Buffer {
	if (fixture === null) return null as unknown as Buffer;
	const kind = fixture.$fixture;
	if (kind === 'audio') return audioBytes(fixture);
	if (kind === 'missing-data') {
		const bytes = audioFixture();
		bytes.write('JUNK', 36);
		return bytes;
	}
	if (kind === 'metadata') return metadataWav(fixture.metadata as Metadata);
	if (kind === 'invalid-header') {
		const bytes = Buffer.alloc(44);
		bytes.write('NOPE');
		return bytes;
	}
	if (kind === 'container-length') {
		const bytes = audioFixture();
		bytes.writeUInt32LE(bytes.length - 7, 4);
		return bytes;
	}
	if (kind === 'missing-format' || kind === 'invalid-format') return chunkBytes(kind);
	if (kind && ['invalid-sample', 'invalid-data', 'unsupported-encoding'].includes(kind))
		return formatBytes(kind);
	if (kind === 'truncated' || kind === 'boundary') return chunkBytes(kind);
	throw new Error('Unknown WAV fixture');
}

function publicWavInfo(bytes: Buffer) {
	expect(audioAssetWavInfo).toBe(mediaWavInfo);
	expect(utilityWavInfo).toBe(mediaWavInfo);
	return audioAssetWavInfo(bytes);
}

function assertOriginalErrors(fixture: Fixture, bytes: Buffer): void {
	if (fixture?.$fixture === 'audio') expect(() => publicWavInfo(bytes)).toThrow(/format/);
	if (fixture?.$fixture === 'missing-data') expect(() => publicWavInfo(bytes)).toThrow(/required/);
}

function invokeWavInfo(...input: never[]) {
	const [fixture] = input as unknown as [Fixture];
	if (fixture?.$fixture === 'audio-with-junk') {
		const wave = audioFixture(1.25);
		const original = publicWavInfo(wave);
		expect(original.durationSeconds).toBe(1.25);
		const extra = publicWavInfo(withJunk(wave));
		expect(extra.durationSeconds).toBe(1.25);
		return [original, extra];
	}
	if (fixture?.$fixture === 'metadata-matrix') {
		const [pcm8, pcm16, pcm24, pcm32] = fixture.matrix as Metadata[];
		return [
			publicWavInfo(metadataWav(pcm8)),
			publicWavInfo(metadataWav(pcm16)),
			publicWavInfo(metadataWav(pcm24)),
			publicWavInfo(metadataWav(pcm32))
		];
	}
	const bytes = fixtureBytes(fixture);
	assertOriginalErrors(fixture, bytes);
	return publicWavInfo(bytes);
}

new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	wavInfo: invokeWavInfo
});
