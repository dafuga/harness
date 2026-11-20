// @harness-uid u_rw64iex44n

import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { StringDecoder } from 'node:string_decoder';
import { clearInterval, setInterval } from 'node:timers';
import type { TaskRunInput } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { TaskProcessResult } from '../ModuleTaskRunnerAdapter.types';
import { ProviderSessionAdapter } from '../ProviderSessionAdapter';
import { TaskOutputOverflowError, type TaskChild } from './taskProcess.types';
import { resourceWork } from '../../../utils/execution-runtimes/resourceWork';
import type { ResourceContext } from '../../../core/execution-runtimes/resourceTypes';
import {
	contextPollMs,
	contextStop,
	defaultContextTokens,
	hardContextTokens,
	providerCompactionTokens,
	telemetryTimeoutMs
} from './sessionPolicy';

/** Keep subscription auth on this host; never forward inherited provider keys or raw event logs. */
export function taskProcess(command: string[], input: TaskRunInput): Promise<TaskProcessResult> {
	return resourceWork(
		{ priority: 'coding', memoryMiB: 2048, label: 'Module task CLI' },
		(resources) => runTaskProcess(command, input, resources),
		process.env,
		{ signal: input.signal }
	);
}

function runTaskProcess(command: string[], input: TaskRunInput, resources: ResourceContext) {
	input.signal.throwIfAborted();
	const env = taskEnvironment(resources);
	if (input.supervision) env.HARNESS_ORCHESTRATION_TRACKER = input.supervision.tracker;
	const child = spawn(command[0], command.slice(1), {
		cwd: input.cwd,
		env,
		stdio: 'pipe',
		detached: process.platform !== 'win32'
	});
	if (child.pid) resources.track(child.pid);
	const meter = new ProviderSessionAdapter(input.provider, join(env.HOME ?? homedir(), '.codex'));
	return collectTaskProcess(child, input, meter);
}

function collectTaskProcess(
	child: TaskChild,
	input: TaskRunInput,
	meter: ProviderSessionAdapter
): Promise<TaskProcessResult> {
	const controller = processMonitor(child, input, meter);
	const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
	lines.on('line', (line) => {
		meter.event(line);
		if (input.provider === 'claude') controller.sample();
	});
	const decoder = new StringDecoder('utf8');
	let stdout = '';
	let overflow = false;
	child.stdout.on('data', (chunk: Buffer) => {
		if (overflow) return;
		stdout += decoder.write(chunk);
		if (stdout.length <= 8_000_000) return;
		overflow = true;
		killGroup(child);
	});
	child.stderr.resume();
	child.stdin.on('error', () => {});
	return new Promise((resolve, reject) => {
		child.once('error', reject);
		child.once('close', (code) => {
			const stop = controller.close();
			if (overflow && !stop)
				reject(new TaskOutputOverflowError('Task CLI output exceeded its bound.'));
			else
				resolve({
					code: code ?? 1,
					stdout: stdout + decoder.end(),
					observation: meter.summary(),
					stop
				});
		});
		child.stdin.end(input.prompt);
	});
}

function processMonitor(child: TaskChild, input: TaskRunInput, meter: ProviderSessionAdapter) {
	const threshold = input.supervision?.contextTokens ?? defaultContextTokens;
	const startedAt = Date.now();
	let exited = false;
	let stop: TaskProcessResult['stop'];
	const halt = (reason: NonNullable<TaskProcessResult['stop']>) => {
		if (!stop || reason === 'hard-limit') stop = reason;
		if (!exited) killGroup(child);
	};
	const sample = () => {
		try {
			const peak = meter.sample().peakContextTokens;
			const reason = contextStop(peak, threshold);
			if (reason === 'hard-limit' || (!exited && reason === 'rotated')) halt(reason);
			else if (!exited && peak === null && Date.now() - startedAt >= telemetryTimeoutMs)
				halt('meter-unavailable');
		} catch {
			halt('meter-unavailable');
		}
	};
	const abort = () => halt('interrupted');
	input.signal.addEventListener('abort', abort, { once: true });
	if (input.signal.aborted) abort();
	const poll = setInterval(sample, contextPollMs);
	const timer = setTimeout(() => halt('timeout'), input.supervision ? 21_600_000 : 900_000);
	child.once('exit', () => {
		exited = true;
		killGroup(child);
	});
	return {
		sample,
		close() {
			exited = true;
			clearInterval(poll);
			clearTimeout(timer);
			input.signal.removeEventListener('abort', abort);
			sample();
			return stop;
		}
	};
}

function killGroup(child: TaskChild): void {
	try {
		if (child.pid) process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL');
	} catch {
		/* The process group already stopped. */
	}
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
	env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = String(hardContextTokens);
	env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE = String(
		Math.floor((100 * providerCompactionTokens) / hardContextTokens)
	);
	return env;
}
