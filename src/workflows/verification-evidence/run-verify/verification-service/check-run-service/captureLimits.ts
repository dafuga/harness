import type { CaptureLimits, CaptureRead } from './captureLimits.types';
import type { GatherResult } from '../../../../../utils/verification-evidence/gatherCaptures';
import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs';
import { verifyConfigFile } from '../../../../../core/verification-evidence/verifyTypes';

const chunkBytes = 1 << 20;

/** The sha256 and size of a file, read in fixed chunks so no capture is held whole in memory. */
export function digestFile(path: string, maxBytes?: number, retain = false): CaptureRead {
	const hash = createHash('sha256');
	const chunk = Buffer.allocUnsafe(chunkBytes);
	const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
	const chunks: Buffer[] = [];
	let bytes = 0;
	try {
		if (!fstatSync(descriptor).isFile()) throw new Error('Capture must be a regular file.');
		for (let read = readSync(descriptor, chunk); read > 0; read = readSync(descriptor, chunk)) {
			bytes += read;
			if (maxBytes !== undefined && bytes > maxBytes)
				throw new Error('Capture exceeded maxCaptureBytes while reading.');
			hash.update(chunk.subarray(0, read));
			if (retain) chunks.push(Buffer.from(chunk.subarray(0, read)));
		}
	} finally {
		closeSync(descriptor);
	}
	return {
		sha256: hash.digest('hex'),
		bytes,
		...(retain ? { contents: Buffer.concat(chunks) } : {})
	};
}

/** Why one capture is refused (a failure phrase after the check's name), or undefined when it fits. */
export function oversizeCapture(
	file: string,
	bytes: number,
	limits: CaptureLimits
): string | undefined {
	const cap = limits.maxCaptureBytes;
	if (cap === undefined || bytes <= cap) return undefined;
	return `left capture ${file} of ${bytes} bytes, over maxCaptureBytes ${cap} in ${verifyConfigFile}; it was not recorded`;
}

/** Totals the captures of one verification record and refuses those that pass `maxRecordBytes`. */
export class RecordBudget {
	private used = 0;

	constructor(private readonly max?: number) {}

	/** What a check's captures may keep, with a failure added for each the record has no room for. */
	admit(result: GatherResult): GatherResult {
		const admitted: GatherResult = { gathered: [], failures: [...result.failures] };
		for (const item of result.gathered) {
			const { bytes, path } = item.capture;
			if (this.max !== undefined && this.used + bytes > this.max) {
				admitted.failures.push(
					`left capture ${path} of ${bytes} bytes, which takes the record to ${this.used + bytes} ` +
						`bytes, over maxRecordBytes ${this.max} in ${verifyConfigFile}; it was not recorded`
				);
				continue;
			}
			this.used += bytes;
			admitted.gathered.push(item);
		}
		return admitted;
	}
}
