import { test, vi } from 'vitest';
import { readTreeTexts } from '../../src/utils/readTreeTexts';
import { recordCapture } from '../../src/utils/record-capture/recordCapture';
import { expect } from '../verificationExpect';

test('metadata reads preserve every requested position while limiting concurrent reads to 64', async () => {
	const paths = Array.from({ length: 145 }, (_, index) => `manifest-${index}`);
	paths[144] = paths[0];
	let active = 0,
		peak = 0;
	const read = vi.fn(async (path: string) => {
		active += 1;
		peak = Math.max(peak, active);
		await Promise.resolve();
		await Promise.resolve();
		active -= 1;
		return `contents of ${path}\n`;
	});
	const output = await readTreeTexts({ read }, paths);
	expect(output).toEqual(paths.map((path) => `contents of ${path}\n`));
	expect(read).toHaveBeenCalledTimes(145);
	expect(peak).toBe(64);
	recordCapture(
		{
			evidence: 'metadata-read-cases',
			kind: 'assertions',
			state: 'metadata-read',
			file: 'metadata-read.json',
			mediaType: 'application/json'
		},
		JSON.stringify({
			scenario: 'Read ordered manifest text without one Git process per file',
			input: { requestedFiles: paths.length, repeatedPath: paths[144] },
			output: {
				returnedTexts: output.length,
				repeatedText: output[144],
				maximumConcurrentReads: peak
			}
		})
	);
});

test('completion order does not change the order of returned metadata', async () => {
	const completed: string[] = [];
	const read = async (path: string) => {
		if (path === 'first') await Promise.resolve();
		completed.push(path);
		return path;
	};
	expect(await readTreeTexts({ read }, ['first', 'second'])).toEqual(['first', 'second']);
	expect(completed).toEqual(['second', 'first']);
});

test('an empty metadata request performs no read', async () => {
	const read = vi.fn();
	expect(await readTreeTexts({ read }, [])).toEqual([]);
	expect(read).not.toHaveBeenCalled();
});

test('unreadable metadata rejects the whole read instead of silently omitting a file', async () => {
	const read = vi.fn(async () => {
		throw new Error('Git object unavailable');
	});
	await expect(readTreeTexts({ read }, ['required'])).rejects.toThrow('Git object unavailable');
});
