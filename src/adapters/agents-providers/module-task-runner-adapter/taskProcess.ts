import { spawn } from 'node:child_process';
import type { TaskRunInput } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { TaskProcessResult } from '../ModuleTaskRunnerAdapter.types';
import { resourceWork } from '../../../utils/execution-runtimes/resourceWork';
import type { ResourceContext } from '../../../core/execution-runtimes/resourceTypes';
/** Keep subscription auth on this host; never forward inherited provider keys or raw event logs. */
export function taskProcess(command: string[], input: TaskRunInput): Promise<TaskProcessResult> {
	return resourceWork(
		{ priority: 'coding', memoryMiB: 2048, label: 'Module task CLI' },
		(resources) => runTaskProcess(command, input, resources),
		process.env,
		{ signal: input.signal }
	);
}
function runTaskProcess(
	command: string[],
	input: TaskRunInput,
	resources: ResourceContext
): Promise<TaskProcessResult> {
	input.signal.throwIfAborted();
	return new Promise((resolve, reject) => {
		const child = spawn(command[0], command.slice(1), {
			cwd: input.cwd,
			env: taskEnvironment(resources),
			stdio: 'pipe',
			detached: process.platform !== 'win32'
		});
		if (child.pid) resources.track(child.pid);
		let stdout = '',
			overflow = false;
		const kill = () => {
			try {
				if (child.pid)
					process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL');
			} catch {
				/* Already stopped. */
			}
		};
		const abort = () => kill();
		input.signal.addEventListener('abort', abort, { once: true });
		const timer = setTimeout(kill, 900000);
		child.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString();
			if (stdout.length > 8_000_000) {
				overflow = true;
				kill();
			}
		});
		child.stderr.resume();
		child.stdin.on('error', () => {});
		child.once('error', reject);
		child.once('exit', kill);
		child.once('close', (code) => {
			clearTimeout(timer);
			input.signal.removeEventListener('abort', abort);
			if (input.signal.aborted) reject(input.signal.reason);
			else if (overflow) reject(new Error('Task CLI output exceeded its bound.'));
			else resolve({ code: code ?? 1, stdout });
		});
		child.stdin.end(input.prompt);
	});
}
function taskEnvironment(resources: ResourceContext): Record<string, string | undefined> {
	const env: Record<string, string | undefined> = {};
	for (const key of [
		'PATH',
		'HOME',
		'USER',
		'LOGNAME',
		'SHELL',
		'TMPDIR',
		'TEMP',
		'LANG',
		'TZ',
		'SYSTEMROOT'
	])
		env[key] = process.env[key];
	for (const key of ['HARNESS_RESOURCE_LEASE', 'HARNESS_RESOURCES_HOME'])
		env[key] = resources.env[key];
	return env;
}
