// @harness-uid u_3mkjgzxnj7
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { TrackerHostCommandError } from './TrackerHostCommandError';
import type { TrackerHostFile, TrackerHostInstallPorts } from '../TrackerHostInstallService.types';

export function writeHostFiles(files: TrackerHostFile[]): void {
	for (const { path, content } of files) {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content, { mode: 0o600 });
	}
}

export function requireHostCommand(
	ports: TrackerHostInstallPorts,
	command: string,
	args: string[]
): void {
	if (ports.run(command, args).status !== 0)
		throw new TrackerHostCommandError(`${command} ${args.join(' ')} failed`);
}
