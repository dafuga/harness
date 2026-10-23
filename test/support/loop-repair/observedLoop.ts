import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
/** Preserve actual process facts while giving fast children time to exit during PID tracking. */
export async function observedLoop(root: string) {
	const bin = join(root, 'bin');
	await mkdir(bin);
	const ps = spawnSync('which', ['ps'], { encoding: 'utf8' }).stdout.trim();
	if (!ps) throw new Error('The process observer fixture requires the native ps executable.');
	await writeFile(
		join(bin, 'ps'),
		`#!/bin/sh\n"${ps}" "$@"\nstatus=$?\nsleep 0.15\nexit "$status"\n`,
		{ mode: 0o755 }
	);
	return spawnSync('bun', [resolve('src/index.ts'), 'loop', 'evaluate', 'proof-loop', '--json'], {
		cwd: root,
		encoding: 'utf8',
		timeout: 5000,
		killSignal: 'SIGKILL',
		env: {
			...process.env,
			PATH: bin + ':' + process.env.PATH,
			HARNESS_RESOURCES_HOME: join(root, 'resources'),
			HARNESS_RESOURCE_LEASE: ''
		}
	});
}
