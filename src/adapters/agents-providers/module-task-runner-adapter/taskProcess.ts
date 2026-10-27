import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { TaskSelection } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type {
	TaskFailureDiagnostic,
	TaskPrelaunchFailureCategory,
	TaskProcessInput,
	TaskProcessResult,
	TaskPublicEvent
} from '../ModuleTaskRunnerAdapter.types';
import { resourceWork } from '../../../utils/execution-runtimes/resourceWork';
import type { ResourceContext } from '../../../core/execution-runtimes/resourceTypes';
const MAX_STDERR_CHARS = 24_000;
/** Keep subscription auth on this host; never forward inherited provider keys or raw event logs. */
export function claudeTaskCommand(selection: TaskSelection): string[] {
	// prettier-ignore
	return [
		'claude', '-p', '--verbose',
		'--output-format', 'stream-json', '--model', selection.model,
		'--effort', selection.intelligence, '--permission-mode', 'acceptEdits',
		'--tools', 'Read,Edit,Write,Glob,Grep,Bash', '--allowedTools', 'Read,Edit,Write,Glob,Grep,Bash',
		'--no-session-persistence'
	];
}
export function parseTaskEvents(stdout: string): TaskPublicEvent[] {
	const events = stdout
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line) as TaskPublicEvent);
	if (
		!events.length ||
		events.some((event) => !event || typeof event.type !== 'string' || !event.type)
	)
		throw new Error('Invalid structured response.');
	return events;
}
export async function taskProcess(
	command: string[],
	input: TaskProcessInput
): Promise<TaskProcessResult> {
	let admitted = false;
	try {
		return await resourceWork(
			{ priority: 'coding', memoryMiB: 2048, label: 'Module task CLI' },
			(resources) => {
				admitted = true;
				return runTaskProcess(command, input, resources);
			},
			process.env,
			{ signal: input.signal }
		);
	} catch (error) {
		if (!admitted && !input.signal.aborted) throw prelaunchFailure('resource');
		throw error;
	}
}
function runTaskProcess(
	command: string[],
	input: TaskProcessInput,
	resources: ResourceContext
): Promise<TaskProcessResult> {
	input.signal.throwIfAborted();
	let child: ChildProcessWithoutNullStreams;
	try {
		child = spawn(command[0], command.slice(1), {
			cwd: input.cwd,
			env: taskEnvironment(resources, input.env ?? process.env),
			stdio: 'pipe',
			detached: process.platform !== 'win32'
		});
	} catch {
		return Promise.reject(prelaunchFailure('spawn'));
	}
	if (child.pid) resources.track(child.pid);
	return collectTaskProcess(child, input);
}
function collectTaskProcess(
	child: ChildProcessWithoutNullStreams,
	input: TaskProcessInput
): Promise<TaskProcessResult> {
	return new Promise((resolve, reject) => {
		let stdout = '',
			stderr = '',
			overflow = false,
			spawnFailed = false;
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
		child.stderr.on('data', (chunk: Buffer) => {
			stderr = `${stderr}${chunk.toString()}`.slice(-MAX_STDERR_CHARS);
		});
		child.stdin.on('error', () => {});
		child.once('error', () => {
			spawnFailed = true;
		});
		child.once('exit', kill);
		child.once('close', (code) => {
			clearTimeout(timer);
			input.signal.removeEventListener('abort', abort);
			if (input.signal.aborted) reject(input.signal.reason);
			else if (spawnFailed) reject(prelaunchFailure('spawn'));
			else if (overflow) reject(new Error('Task CLI output exceeded its bound.'));
			else resolve({ code: code ?? 1, stdout, stderr });
		});
		child.stdin.end(input.prompt);
	});
}
function prelaunchFailure(category: TaskPrelaunchFailureCategory): Error {
	const diagnostic: TaskFailureDiagnostic = {
		category,
		phase: 'prelaunch',
		nextAction:
			category === 'resource'
				? 'Check the resource queue and available worker capacity before retrying.'
				: 'Check that the selected CLI is installed and available on PATH, then retry.'
	};
	const message =
		category === 'resource'
			? 'Task could not start because resource admission failed.'
			: 'Task CLI could not be started.';
	return Object.assign(new Error(message), { quotaRejected: false, diagnostic });
}
function taskEnvironment(
	resources: ResourceContext,
	base: Record<string, string | undefined>
): Record<string, string | undefined> {
	const env: Record<string, string | undefined> = {};
	for (const key of [
		'PATH',
		'HOME',
		'CODEX_HOME',
		'CLAUDE_CONFIG_DIR',
		'HARNESS_TASK_CONTRACT_SNAPSHOT',
		'USER',
		'LOGNAME',
		'SHELL',
		'TMPDIR',
		'TEMP',
		'LANG',
		'TZ',
		'SYSTEMROOT'
	])
		env[key] = base[key];
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
