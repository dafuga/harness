function waveChunks(bytes: Buffer) {
	const chunks = new Map<string, Buffer>();
	const limit = bytes.readUInt32LE(4) + 8;
	if (limit !== bytes.length) throw new Error('Invalid WAV container length');
	let offset = 12;
	while (offset + 8 <= limit) {
		const name = bytes.toString('ascii', offset, offset + 4);
		const length = bytes.readUInt32LE(offset + 4);
		if (offset + 8 + length > limit) throw new Error('Truncated WAV chunk');
		if (!chunks.has(name)) chunks.set(name, bytes.subarray(offset + 8, offset + 8 + length));
		offset += 8 + length + (length % 2);
	}
	if (offset !== limit) throw new Error('Invalid WAV chunk boundary');
	return chunks;
}
function waveEncoding(format: Buffer) {
	const encoding = format.readUInt16LE(0);
	const channels = format.readUInt16LE(2);
	const sampleRate = format.readUInt32LE(4);
	const bits = format.readUInt16LE(14);
	const validEncoding = encoding === 1 || (encoding === 3 && bits === 32);
	if (!validEncoding || channels < 1 || channels > 8 || sampleRate < 4000 || sampleRate > 384000)
		throw new Error('Unsupported WAV audio format');
}
function validFormat(format: Buffer) {
	if (format.length < 16) throw new Error('Invalid WAV format');
	waveEncoding(format);
	const channels = format.readUInt16LE(2);
	const sampleRate = format.readUInt32LE(4);
	const bytesPerSecond = format.readUInt32LE(8);
	const align = format.readUInt16LE(12);
	const bits = format.readUInt16LE(14);
	if (
		![8, 16, 24, 32].includes(bits) ||
		align !== (channels * bits) / 8 ||
		bytesPerSecond !== sampleRate * align
	)
		throw new Error('Invalid WAV sample format');
	return { bytesPerSecond, align };
}
export function wavInfo(bytes: Buffer) {
	if (
		bytes.length < 44 ||
		bytes.toString('ascii', 0, 4) !== 'RIFF' ||
		bytes.toString('ascii', 8, 12) !== 'WAVE'
	)
		throw new Error('Invalid WAV audio');
	const chunks = waveChunks(bytes);
	const format = chunks.get('fmt ');
	const data = chunks.get('data');
	if (!format || !data?.length) throw new Error('WAV format and audio data are required');
	const { bytesPerSecond, align } = validFormat(format);
	if (data.length % align) throw new Error('Invalid WAV audio data length');
	return { durationSeconds: data.length / bytesPerSecond };
}
