// @harness-uid u_34r2rrehaa
/** Owns capped stdout/stderr prefixes for one child command. */
export function commandOutput(maxBytes: number) {
	const chunks = { stdout: [] as Buffer[], stderr: [] as Buffer[] };
	let size = 0;
	return {
		append(stream: 'stdout' | 'stderr', chunk: Buffer): boolean {
			const remaining = maxBytes - size;
			const length = Math.min(chunk.length, remaining);
			if (length) {
				chunks[stream].push(Buffer.from(chunk.subarray(0, length)));
				size += length;
			}
			return length === chunk.length;
		},
		read() {
			return {
				stdout: Buffer.concat(chunks.stdout),
				stderr: Buffer.concat(chunks.stderr).toString('utf8')
			};
		}
	};
}
