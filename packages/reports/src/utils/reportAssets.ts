import { lstat, realpath, mkdir, writeFile } from 'node:fs/promises';
import { join, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';

const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function imageExtension(bytes: Buffer) {
	const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
	const jpeg = bytes[0] === 255 && bytes[1] === 216;
	const webp =
		bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
	if (png) return '.png';
	if (jpeg) return '.jpg';
	if (webp) return '.webp';
	throw new Error('Evidence must be a valid PNG, JPEG or WebP image');
}

export function imageAsset(bytes: Buffer, filename: string) {
	if (!bytes.length || bytes.length > 50_000_000) throw new Error('Invalid evidence file or size');
	const extension = extname(filename).toLowerCase();
	if (!allowed.has(extension)) throw new Error('Unsupported evidence format');
	const actual = imageExtension(bytes);
	if (extension !== actual && !(extension === '.jpeg' && actual === '.jpg'))
		throw new Error('Image content does not match its filename');
	return {
		name: createHash('sha256').update(bytes).digest('hex') + actual,
		mime: { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' }[actual]
	};
}

export async function writeImageAsset(directory: string, name: string, bytes: Buffer) {
	await mkdir(join(directory, 'assets'), { recursive: true, mode: 0o700 });
	await writeFile(join(directory, 'assets', name), bytes, { mode: 0o600 });
}

export async function registeredAsset(directory: string, name: string, registered: string[]) {
	if (!registered.includes(name) || name.includes('/') || name.includes('\\'))
		throw new Error('Unregistered asset');
	const base = await realpath(directory);
	const path = join(base, name);
	const info = await lstat(path);
	if (info.isSymbolicLink() || !info.isFile()) throw new Error('Invalid asset');
	if (!(await realpath(path)).startsWith(base + sep)) throw new Error('Invalid asset path');
	return path;
}

export { reportAssets } from '../repositories/report-repository/reportAssets';
