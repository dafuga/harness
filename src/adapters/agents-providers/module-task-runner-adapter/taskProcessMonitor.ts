// @harness-uid u_rw64iex44n
import { parsePositiveIntegerEnvironmentValue } from './taskProcess';
import { clearInterval, setInterval } from 'node:timers';
import type { TaskRunInput } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { TaskProcessResult } from '../ModuleTaskRunnerAdapter.types';
import type { ProviderSessionAdapter } from '../ProviderSessionAdapter';
import type { ProviderRequestGate } from './ProviderRequestGate';
import type { TaskChild } from './taskProcess.types';
import {
	contextPollMs,
	contextStop,
	defaultContextTokens,
	telemetryTimeoutMs
} from './sessionPolicy';

export function processMonitor(
	child: TaskChild,
	input: TaskRunInput,
	meter: ProviderSessionAdapter,
	gate?: ProviderRequestGate
) {
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
			if (reason === 'hard-limit') halt(reason);
			else if (gate?.blockedEstimate !== undefined || (!exited && reason === 'rotated'))
				halt('rotated');
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
	const timer = setTimeout(
		() => halt('timeout'),
		parsePositiveIntegerEnvironmentValue(
			process.env.HARNESS_TASK_TIMEOUT_MS,
			input.supervision ? 21_600_000 : 900_000
		)
	);
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

export function killGroup(child: TaskChild): void {
	try {
		if (child.pid) process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL');
	} catch {
		/* The process group already stopped. */
	}
}
