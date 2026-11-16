// @harness-uid u_rw64iex44n
import { spawn } from 'node:child_process';
import type { TaskRunInput } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { TaskProcessResult } from '../ModuleTaskRunnerAdapter.types';
import { TaskOutputOverflowError } from './taskProcess.types';
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
	const timeoutMs = parsePositiveIntegerEnvironmentValue(
		process.env.HARNESS_TASK_TIMEOUT_MS,
		900_000
	);
	const outputBytes = parsePositiveIntegerEnvironmentValue(
		process.env.HARNESS_TASK_OUTPUT_BYTES,
		8_000_000
	);
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
		const timer = setTimeout(kill, timeoutMs);
		child.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString();
			if (stdout.length > outputBytes) {
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
			else if (overflow) reject(new TaskOutputOverflowError('Task CLI output exceeded its bound.'));
			else resolve({ code: code ?? 1, stdout });
		});
		child.stdin.end(input.prompt);
	});
}
export function parsePositiveIntegerEnvironmentValue(
	value: string | undefined,
	fallback: number
): number {
	if (value === undefined || !/^\d+$/.test(value)) return fallback;
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
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
	for (const key of [
		'HARNESS_RESOURCE_LEASE',
		'HARNESS_RESOURCES_HOME',
		'HARNESS_RESOURCE_CPUS',
		'HARNESS_RESOURCE_MEMORY_MIB',
		'HARNESS_RESOURCE_PRIORITY'
	])
		env[key] = resources.env[key];
	return env;
}
