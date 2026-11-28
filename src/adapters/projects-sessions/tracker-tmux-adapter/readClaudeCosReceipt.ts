// @harness-uid u_fyf7e7kyi5
import { constants } from 'node:fs';
import { open, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CosReceipt } from './readClaudeCosReceipt.types';

const transcriptName = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}\.jsonl$/i;
const tailBytes = 512 * 1024;
const heading = 'Tracker watchdog alerts for Chief of Staff. Review these items. ';

/** Claude can accept a prompt without showing the transition in a tmux capture. */
export async function readClaudeCosReceipts(
	cwd: string | undefined,
	receipts: readonly CosReceipt[],
	projects: string = join(homedir(), '.claude', 'projects')
): Promise<Set<string>> {
	const found = new Set<string>();
	if (!cwd?.startsWith('/') || !receipts.length) return found;
	const directory = join(projects, cwd.replace(/[^a-z0-9-]/gi, '-'));
	const names = await readdir(directory).catch(() => []);
	const candidates = await Promise.all(
		names
			.filter((name) => transcriptName.test(name))
			.map(async (name) => {
				const path = join(directory, name);
				const info = await stat(path).catch(() => undefined);
				return { path, mtime: info?.mtimeMs ?? 0 };
			})
	);
	candidates.sort((a, b) => b.mtime - a.mtime);
	for (const { path } of candidates.slice(0, 4)) {
		for (const prompt of await acceptedPrompts(path)) {
			for (const id of matchingReceipts(prompt, receipts)) found.add(id);
		}
	}
	return found;
}

async function acceptedPrompts(path: string) {
	const file = await open(
		path,
		constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
	).catch(() => undefined);
	if (!file) return [];
	const buffer = Buffer.alloc(tailBytes);
	try {
		const info = await file.stat();
		if (!info.isFile() || info.uid !== process.getuid?.()) return [];
		const start = Math.max(0, info.size - tailBytes);
		const { bytesRead } = await file.read(buffer, 0, tailBytes, start);
		return buffer
			.toString('utf8', 0, bytesRead)
			.split('\n')
			.filter((line) => line.includes(heading))
			.flatMap(parseAcceptedPrompt);
	} catch {
		return [];
	} finally {
		buffer.fill(0);
		await file.close();
	}
}

function parseAcceptedPrompt(line: string): { at: number; message: string }[] {
	try {
		const row = JSON.parse(line);
		const at = Date.parse(row.timestamp);
		let text: unknown;
		if (row.type === 'user' && row.message?.role === 'user') text = row.message.content;
		if (row.type === 'queue-operation' && row.operation === 'enqueue') text = row.content;
		if (!Number.isFinite(at) || typeof text !== 'string') return [];
		const accepted = compact(text);
		const start = compact(heading);
		return accepted.startsWith(start) ? [{ at, message: accepted.slice(start.length) }] : [];
	} catch {
		return [];
	}
}

function matchingReceipts(
	{ at, message }: { at: number; message: string },
	receipts: readonly CosReceipt[]
) {
	// The legacy flag relay could append its prompt to the same Claude input.
	const [summary] = message.split(
		/\|\|Slotsbycomputer:|NEWFLAGTRIAGE\(automated,flag-triage\.py,nottypedbyDaniel\):/,
		1
	);
	const references = /^Watchdogreceipts:([a-f0-9,]+)\|\|/.exec(summary)?.[1];
	const refs = new Set(references?.split(','));
	return receipts
		.filter(({ line, reference, since }) => {
			if (references !== undefined) return refs.has(reference);
			// Before references were added, Claude recorded the original rendered line.
			return at >= since && `|${summary}|`.includes(`|${compact(line)}|`);
		})
		.map(({ id }) => id);
}

function compact(text: string) {
	return text.replace(/<\/?pasted_content(?: id="[^"]+")?>/g, '').replace(/\s+/gu, '');
}
