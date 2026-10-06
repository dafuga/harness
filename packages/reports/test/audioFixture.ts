export function audioFixture(seconds = 3, frequency = 440) {
	const rate = 16000;
	const samples = Math.floor(rate * seconds);
	const bytes = Buffer.alloc(44 + samples * 2);
	bytes.write('RIFF');
	bytes.writeUInt32LE(bytes.length - 8, 4);
	bytes.write('WAVEfmt ', 8);
	bytes.writeUInt32LE(16, 16);
	bytes.writeUInt16LE(1, 20);
	bytes.writeUInt16LE(1, 22);
	bytes.writeUInt32LE(rate, 24);
	bytes.writeUInt32LE(rate * 2, 28);
	bytes.writeUInt16LE(2, 32);
	bytes.writeUInt16LE(16, 34);
	bytes.write('data', 36);
	bytes.writeUInt32LE(samples * 2, 40);
	for (let i = 0; i < samples; i++)
		bytes.writeInt16LE(
			Math.round(Math.sin((i * 2 * Math.PI * frequency) / rate) * 4000),
			44 + i * 2
		);
	return bytes;
}
