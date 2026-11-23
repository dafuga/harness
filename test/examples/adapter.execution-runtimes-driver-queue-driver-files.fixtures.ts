import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';
import { driverProcesses } from '../../src/adapters/execution-runtimes/driver-queue/driverFiles';

export function installFakePs(directory: string): string {
	const bin = join(directory, 'bin');
	const lines = [
		[
			'/usr/bin/python /fixture/driver/code_task.py',
			'--model model-a --tasks-file /fixture/driver/tasks.json',
			'--wave wave-4 --slot 7'
		].join(' '),
		[
			'/usr/bin/python /fixture/other/code_task.py',
			'--model model-b --tasks-file /fixture/other/tasks.json',
			'--wave wave-5 --slot 2'
		].join(' '),
		[
			'/usr/bin/python /fixture/driver/code_task.py',
			'--model incomplete --tasks-file /fixture/driver/incomplete.json',
			'--wave wave-6'
		].join(' ')
	];
	mkdirSync(bin);
	const executable = join(bin, 'ps');
	writeFileSync(executable, `#!/bin/sh\nprintf '%s\\n' '${lines.join("' '")}'\n`);
	chmodSync(executable, 0o700);
	return bin;
}

export function readDriverProcesses(bin: string) {
	vi.stubEnv('PATH', bin);
	try {
		return { scoped: driverProcesses('/fixture/driver'), unscoped: driverProcesses() };
	} finally {
		vi.unstubAllEnvs();
	}
}
