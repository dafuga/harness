// @harness-uid u_rw64iex44n

import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { StringDecoder } from 'node:string_decoder';
import type {
	TaskPlatform,
	TaskRunInput
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { TaskProcessResult } from '../ModuleTaskRunnerAdapter.types';
import { ProviderSessionAdapter } from '../ProviderSessionAdapter';
import {
	ManagedProviderDockerAdapter,
	managedProviderDockerResources
} from '../ManagedProviderDockerAdapter';
import { TaskOutputOverflowError, type TaskChild } from './taskProcess.types';
import { resourceWork } from '../../../utils/execution-runtimes/resourceWork';
import type { ResourceContext } from '../../../core/execution-runtimes/resourceTypes';
import { ProviderRequestGate } from './ProviderRequestGate';
import { guardedProviderCommand } from './provider-request-gate/providerDestination';
import { ModuleTaskRunError } from './ModuleTaskRunError';
import { processMonitor, killGroup } from './taskProcessMonitor';
import { hardContextTokens, providerCompactionTokens } from './sessionPolicy';

/** Keep native subscription auth on this host. The Docker pilot runs offline. */
export async function taskProcess(
	command: string[],
	input: TaskRunInput
): Promise<TaskProcessResult> {
	const image = dockerTaskImage(
		input.platform,
		process.platform,
		process.env.HARNESS_TASK_DOCKER_IMAGE
	);
	return resourceWork(
		{
			priority: 'coding',
			label: 'Module task CLI',
			cpus: parsePositiveNumberEnvironmentValue(
				process.env.HARNESS_TASK_CPUS,
				image ? managedProviderDockerResources.cpus : 1
			),
			memoryMiB: parsePositiveIntegerEnvironmentValue(
				process.env.HARNESS_TASK_MEMORY_MIB,
				image ? managedProviderDockerResources.memoryMiB : 2048
			)
		},
		(resources) =>
			image
				? runDockerTaskProcess(command, input, resources, image)
				: runNativeTaskProcess(command, input, resources),
		process.env,
		{ signal: input.signal }
	);
}

export function dockerTaskImage(
	platform: TaskPlatform | undefined,
	host: typeof process.platform,
	image?: string
): string | undefined {
	if (platform === 'macos' && host !== 'darwin')
		throw new ModuleTaskRunError('This task requires native macOS.');
	if (platform !== 'linux') return undefined;
	if (host !== 'linux' && host !== 'darwin')
		throw new ModuleTaskRunError('The Linux Docker pilot requires a Linux or macOS host.');
	if (!image || !/^sha256:[a-f0-9]{64}$/.test(image))
		throw new ModuleTaskRunError(
			'Set HARNESS_TASK_DOCKER_IMAGE to the full ID of an approved local Linux fixture image.'
		);
	return image;
}

function runDockerTaskProcess(
	command: string[],
	input: TaskRunInput,
	resources: ResourceContext,
	image: string
) {
	const meter = new ProviderSessionAdapter(input.provider, undefined);
	return new ManagedProviderDockerAdapter().run(
		command,
		{ cwd: input.cwd, signal: input.signal, image },
		(child) => {
			if (child.pid) resources.track(child.pid);
			return collectTaskProcess(child, input, meter);
		}
	);
}

async function runNativeTaskProcess(
	command: string[],
	input: TaskRunInput,
	resources: ResourceContext
) {
	input.signal.throwIfAborted();
	const env = taskEnvironment(resources);
	if (input.supervision) env.HARNESS_ORCHESTRATION_TRACKER = input.supervision.tracker;
	const meter = new ProviderSessionAdapter(input.provider, join(env.HOME ?? homedir(), '.codex'));
	const gate = new ProviderRequestGate(input.provider, () => meter.sample().peakContextTokens);
	try {
		if (input.provider === 'claude') env.ANTHROPIC_BASE_URL = gate.origin;
		const guarded = guardedProviderCommand(command, input.provider, gate.origin);
		const child = spawn(guarded[0], guarded.slice(1), {
			cwd: input.cwd,
			env,
			stdio: 'pipe',
			detached: process.platform !== 'win32'
		});
		if (child.pid) resources.track(child.pid);
		return await collectTaskProcess(child, input, meter, gate);
	} finally {
		await gate.close();
	}
}

function collectTaskProcess(
	child: TaskChild,
	input: TaskRunInput,
	meter: ProviderSessionAdapter,
	gate?: ProviderRequestGate
): Promise<TaskProcessResult> {
	const controller = processMonitor(child, input, meter, gate);
	const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
	lines.on('line', (line) => {
		meter.event(line);
		if (input.provider === 'claude') controller.sample();
	});
	const decoder = new StringDecoder('utf8');
	const outputBytes = parsePositiveIntegerEnvironmentValue(
		process.env.HARNESS_TASK_OUTPUT_BYTES,
		8_000_000
	);
	let stdout = '';
	let overflow = false;
	child.stdout.on('data', (chunk: Buffer) => {
		if (overflow) return;
		stdout += decoder.write(chunk);
		if (stdout.length <= outputBytes) return;
		overflow = true;
		killGroup(child);
	});
	child.stderr.resume();
	child.stdin.on('error', () => {});
	return new Promise((resolve, reject) => {
		let launchError: Error | undefined;
		child.once('error', (error) => {
			launchError = error;
		});
		child.once('close', (code) => {
			const stop = controller.close();
			if (launchError) reject(launchError);
			else if (overflow && !stop)
				reject(new TaskOutputOverflowError('Task CLI output exceeded its bound.'));
			else
				resolve({
					code: code ?? 1,
					stdout: stdout + decoder.end(),
					observation: meter.summary(),
					preRequestEstimateTokens: gate?.blockedEstimate,
					stop
				});
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
export function parsePositiveNumberEnvironmentValue(
	value: string | undefined,
	fallback: number
): number {
	if (value === undefined) return fallback;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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
		'TERM',
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
