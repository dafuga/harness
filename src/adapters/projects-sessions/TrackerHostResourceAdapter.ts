import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statfsSync } from 'node:fs';
import { availableParallelism, freemem, loadavg, totalmem } from 'node:os';
import { dirname } from 'node:path';
import type {
	TrackerHostResources,
	TrackerHostVolume
} from '../../utils/projects-sessions/trackerHostResources.types';

/** Admission runs several times per scheduler tick; reuse one memory reading briefly. */
const memoryAge = 5000;

/** Read the local computer's load, memory, disk and inode availability. */
export class TrackerHostResourceAdapter implements TrackerHostResources {
	private reading?: { at: number; value: ReturnType<TrackerHostResources['memory']> };

	constructor(private readonly platform: NodeJS.Platform = process.platform) {}

	cores(): number {
		return availableParallelism();
	}

	load(): readonly [number, number] {
		const [one, five] = loadavg();
		return [one, five];
	}

	memory() {
		const at = Date.now();
		if (!this.reading || at - this.reading.at >= memoryAge)
			this.reading = { at, value: this.platform === 'darwin' ? macMemory() : otherMemory() };
		return this.reading.value;
	}

	volume(path: string): TrackerHostVolume {
		let target = path;
		while (!existsSync(target) && dirname(target) !== target) target = dirname(target);
		const { bavail, bsize, files, ffree } = statfsSync(target);
		return {
			freeGB: (bavail * bsize) / 1024 ** 3,
			...(files > 0 && { freeInodes: ffree, inodeFreePercent: (100 * ffree) / files })
		};
	}
}

/** macOS free pages alone understate availability; use the system's pressure reading. */
function macMemory() {
	try {
		const output = execFileSync('/usr/bin/memory_pressure', ['-Q'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
			timeout: 3000
		});
		const match = /System-wide memory free percentage:\s*(\d+)%/.exec(output);
		if (match) {
			const freePercent = Number(match[1]);
			return { freePercent, availableMB: (totalmem() * freePercent) / 100 / 1024 ** 2 };
		}
	} catch {
		// An unknown percentage holds Mac launches.
	}
	return { freePercent: null, availableMB: freemem() / 1024 ** 2 };
}

function otherMemory() {
	let available = freemem();
	try {
		const match = /MemAvailable:\s+(\d+) kB/.exec(readFileSync('/proc/meminfo', 'utf8'));
		if (match) available = Number(match[1]) * 1024;
	} catch {
		// Hosts without /proc report free memory.
	}
	return { freePercent: (100 * available) / totalmem(), availableMB: available / 1024 ** 2 };
}
