import type { Weighed } from './hostScale.types';
import { createHash, randomBytes } from 'node:crypto';
import { cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { ownEnvironment, runCommand } from './cli';

const wrangler = resolve(import.meta.dirname, '../../node_modules/.bin/wrangler');
const kibibyte = 1024;
/** One verification record of a console-sized scenario: nine states at three widths, and a clip. */
const record = [
	...Array.from({ length: 9 }, () => ['png', 300 * kibibyte] as const),
	...Array.from({ length: 9 }, () => ['png', 180 * kibibyte] as const),
	...Array.from({ length: 9 }, () => ['png', 90 * kibibyte] as const),
	['wav', 88 * kibibyte] as const
];

/**
 * A copy of a history index with the media of `records` more verification records beside it.
 * The bytes are random, as incompressible as screenshots and audio are, and named by their hash
 * as the index names media; nothing here is a capture of anything.
 */
export async function withRecordedMedia(
	index: string,
	out: string,
	records: number
): Promise<string[]> {
	await cp(index, out, { recursive: true });
	await mkdir(join(out, 'media'), { recursive: true });
	const names: string[] = [];
	for (let at = 0; at < records; at += 1) {
		for (const [extension, bytes] of record) {
			const content = randomBytes(bytes);
			const name = `${createHash('sha256').update(content).digest('hex')}.${extension}`;
			await writeFile(join(out, 'media', name), content);
			names.push(name);
		}
	}
	return names;
}

/** Number and total size of the files under a directory; zero when it does not exist. */
export async function weighed(directory: string): Promise<Weighed> {
	const entries = await readdir(directory, { recursive: true, withFileTypes: true }).catch(
		() => []
	);
	const files = entries.filter((entry) => entry.isFile());
	const sizes = await Promise.all(files.map((entry) => stat(join(entry.parentPath, entry.name))));
	return { files: files.length, bytes: sizes.reduce((sum, file) => sum + file.size, 0) };
}

/**
 * The Worker script as Wrangler bundles it for a deployment, weighed raw and compressed: the
 * compressed size is what the platform limits.
 */
export async function deployedWorker(
	host: string
): Promise<{ bytes: number; compressedBytes: number }> {
	const env = { ...ownEnvironment(), WRANGLER_SEND_METRICS: 'false', CI: '1' };
	const settings = { ...env, XDG_CONFIG_HOME: join(host, '.config') };
	const build = [
		'pages',
		'functions',
		'build',
		'--build-output-directory',
		'.svelte-kit/cloudflare'
	];
	await runCommand([wrangler, ...build, '--outdir', '.bundled'], host, true, settings);
	const script = await readFile(join(host, '.bundled/_worker.js'));
	return { bytes: script.length, compressedBytes: gzipSync(script).length };
}

export type { Weighed } from './hostScale.types';
