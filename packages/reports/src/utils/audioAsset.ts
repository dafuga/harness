import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import { mediaMime } from './evidenceMedia';
import { wavInfo } from './wavInfo';
function mp3Offset(bytes: Buffer) {
	if (bytes.toString('ascii', 0, 3) !== 'ID3') return 0;
	if (bytes.length < 10 || bytes.subarray(6, 10).some((value) => value & 128)) return -1;
	const length = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
	return 10 + length + (bytes[5] & 16 ? 10 : 0);
}
function validMp3Header(header: number) {
	return (
		header >>> 21 === 2047 &&
		((header >>> 19) & 3) !== 1 &&
		((header >>> 17) & 3) === 1 &&
		((header >>> 12) & 15) > 0 &&
		((header >>> 12) & 15) < 15 &&
		((header >>> 10) & 3) !== 3
	);
}
function mp3FrameSize(header: number) {
	if (!validMp3Header(header)) return 0;
	const version = (header >>> 19) & 3;
	const rates =
		version === 3
			? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
			: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
	const divisor: Record<number, number> = { 0: 4, 2: 2, 3: 1 };
	const rate = [44100, 48000, 32000][(header >>> 10) & 3] / divisor[version];
	return (
		Math.floor(((version === 3 ? 144000 : 72000) * rates[(header >>> 12) & 15]) / rate) +
		((header >>> 9) & 1)
	);
}
function mp3Audio(bytes: Buffer) {
	const offset = mp3Offset(bytes);
	if (offset < 0 || offset + 4 >= bytes.length) return false;
	const size = mp3FrameSize(bytes.readUInt32BE(offset));
	return size > 4 && offset + size <= bytes.length;
}
function oggAudio(bytes: Buffer) {
	if (bytes.length < 35 || bytes.toString('ascii', 0, 4) !== 'OggS' || bytes[4] !== 0) return false;
	const header = 27 + bytes[26];
	const size = bytes.subarray(27, header).reduce((sum, value) => sum + value, 0);
	if (header + size > bytes.length) return false;
	return (
		bytes.toString('ascii', header, header + 8) === 'OpusHead' ||
		bytes.toString('ascii', header, header + 7) === '\x01vorbis' ||
		bytes.toString('ascii', header, header + 5) === '\x7fFLAC'
	);
}
function m4aHeader(bytes: Buffer) {
	if (bytes.length < 24 || bytes.toString('ascii', 4, 8) !== 'ftyp') return 0;
	const size = bytes.readUInt32BE(0);
	return size >= 16 && size <= bytes.length ? size : 0;
}
function m4aBoxes(bytes: Buffer, offset: number) {
	const boxes: { type: string; data: Buffer }[] = [];
	while (offset + 8 <= bytes.length) {
		const length = bytes.readUInt32BE(offset) || bytes.length - offset;
		if (length < 8 || offset + length > bytes.length) return null;
		boxes.push({
			type: bytes.toString('ascii', offset + 4, offset + 8),
			data: bytes.subarray(offset + 8, offset + length)
		});
		offset += length;
	}
	return offset === bytes.length ? boxes : null;
}
function m4aAudio(bytes: Buffer) {
	const offset = m4aHeader(bytes);
	if (!offset) return false;
	const boxes = m4aBoxes(bytes, offset);
	if (!boxes) return false;
	const data = boxes.find((box) => box.type === 'mdat');
	const movie = boxes.find((box) => box.type === 'moov');
	if (!data || !movie) return false;
	return (
		data.data.length > 0 &&
		movie.data.includes(Buffer.from('soun')) &&
		movie.data.includes(Buffer.from('stsd'))
	);
}
const validators: Record<string, (bytes: Buffer) => boolean> = {
	'.mp3': mp3Audio,
	'.ogg': oggAudio,
	'.m4a': m4aAudio
};
export function audioAsset(bytes: Buffer, filename: string) {
	if (!bytes.length || bytes.length > 50_000_000) throw new Error('Invalid audio file or size');
	const extension = extname(filename).toLowerCase();
	const mime = mediaMime(filename);
	if (!mime.startsWith('audio/')) throw new Error('Unsupported audio format');
	const metadata = extension === '.wav' ? wavInfo(bytes) : {};
	if (extension !== '.wav' && !validators[extension]?.(bytes))
		throw new Error('Audio content does not match its filename');
	return {
		name: createHash('sha256').update(bytes).digest('hex') + extension,
		mimeType: mime,
		mediaType: 'audio' as const,
		...metadata
	};
}
