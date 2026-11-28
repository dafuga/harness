// @harness-uid u_r7qgepnoax
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs';

export function readTrackerJsonFile(file: string, limit: number, description: string): unknown {
	try {
		const fd = openSync(file, constants.O_RDONLY | constants.O_NONBLOCK);
		try {
			const info = fstatSync(fd);
			if (!info.isFile() || info.size > limit) throw new TypeError('invalid input file');
			const buffer = Buffer.alloc(limit + 1);
			const size = readSync(fd, buffer, 0, buffer.length, 0);
			if (size > limit) throw new TypeError('invalid input file');
			return JSON.parse(buffer.subarray(0, size).toString('utf8'));
		} finally {
			closeSync(fd);
		}
	} catch {
		throw new TypeError(`could not read ${description} JSON file`);
	}
}
