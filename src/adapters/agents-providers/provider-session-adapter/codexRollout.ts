// @harness-uid u_jqwsplz2qq
import { closeSync, fstatSync, openSync, readdirSync, readSync } from 'node:fs';
import { join } from 'node:path';
import type { TokenCountEvent } from '../ProviderSessionAdapter.types';
import { ProviderSessionTelemetryError } from './ProviderSessionTelemetryError';

const recordLimit = 32 * 1024;
const scanBudget = 1024 * 1024;
const sessionIdPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export function findCodexRollout(home: string, id: string, startedAt: number): string | undefined {
	if (!sessionIdPattern.test(id)) return undefined;
	for (const day of [0, -1, 1]) {
		const date = new Date(startedAt + day * 86_400_000).toISOString().slice(0, 10);
		const directory = join(home, 'sessions', date.replaceAll('-', '/'));
		const name = rolloutNames(directory).find(
			(name) => name.startsWith('rollout-') && name.endsWith(`-${id}.jsonl`)
		);
		if (name) return join(directory, name);
	}
	return undefined;
}

function rolloutNames(directory: string): string[] {
	try {
		return readdirSync(directory);
	} catch (error) {
		if ((error as { code?: string }).code === 'ENOENT') return [];
		throw error;
	}
}

/** Read only new bytes, keeping an incomplete counter row across appends. */
export class CodexRolloutReader {
	private offset = 0;
	private identity?: string;
	private fragment: Buffer | null = Buffer.alloc(0);
	private readonly buffer = Buffer.allocUnsafe(64 * 1024);

	read(path: string, record: (event: TokenCountEvent) => void): void {
		const fd = openSync(path, 'r');
		try {
			const { size, dev, ino } = fstatSync(fd);
			const identity = `${dev}:${ino}`;
			this.identity ??= identity;
			if (this.identity !== identity || size < this.offset)
				throw new ProviderSessionTelemetryError(
					'Codex session telemetry was replaced or truncated.'
				);
			const end = Math.min(size, this.offset + scanBudget);
			while (this.offset < end) {
				const count = readSync(
					fd,
					this.buffer,
					0,
					Math.min(this.buffer.length, end - this.offset),
					this.offset
				);
				if (!count) break;
				this.offset += count;
				this.scan(this.buffer.subarray(0, count), record);
			}
		} finally {
			closeSync(fd);
		}
	}

	private scan(bytes: Buffer, record: (event: TokenCountEvent) => void): void {
		let from = 0;
		for (let end = bytes.indexOf(10); end >= 0; end = bytes.indexOf(10, from)) {
			this.append(bytes.subarray(from, end));
			const line = this.fragment;
			this.fragment = Buffer.alloc(0);
			if (line?.includes('"token_count"')) {
				const parsed = usageEvent(line);
				if (parsed) record(parsed);
			}
			from = end + 1;
		}
		this.append(bytes.subarray(from));
	}

	private append(bytes: Buffer): void {
		if (!this.fragment || !bytes.length) return;
		this.fragment =
			this.fragment.length + bytes.length <= recordLimit
				? Buffer.concat([this.fragment, bytes])
				: null;
	}
}

function usageEvent(line: Buffer): TokenCountEvent | undefined {
	try {
		const row = JSON.parse(line.toString('utf8'));
		return row.type === 'event_msg' && row.payload?.type === 'token_count'
			? row.payload
			: undefined;
	} catch {
		return undefined;
	}
}
