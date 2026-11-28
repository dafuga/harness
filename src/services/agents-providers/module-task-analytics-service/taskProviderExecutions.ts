// @harness-uid u_x665iye7um
import type {
	ModuleTask,
	TaskExecution
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { sumSessionUsage } from '../../../adapters/agents-providers/provider-session-adapter/sumSessionUsage';
import { taskApiCost } from './taskPricing';

/** Repair turns inside a claim count as one provider run for acceptance and escalation rates. */
export function executionsOf(
	result: NonNullable<ModuleTask['result']>
): (Omit<TaskExecution, 'startedAt'> & { startedAt?: string })[] {
	if (!result.executions.length) return [legacyExecution(result)];
	if (!result.checkRounds?.length) return result.executions;
	const first = result.executions[0];
	const alternate = result.executions.findIndex(
		(execution) => execution.provider !== first.provider
	);
	return alternate === -1
		? [combineTurns(result.executions)]
		: [
				combineTurns(result.executions.slice(0, alternate)),
				combineTurns(result.executions.slice(alternate))
			];
}

function combineTurns(turns: TaskExecution[]): TaskExecution {
	if (turns.length === 1) return turns[0];
	const last = turns.at(-1)!;
	const usage = sumSessionUsage(turns.map((turn) => turn.usage));
	const totals = (key: 'usd' | 'minimumUsd' | 'maximumUsd') => {
		const values = turns.map((turn) => turn.apiCost[key]);
		return values.every((value) => value !== null)
			? values.reduce<number>((sum, value) => sum + value!, 0)
			: null;
	};
	return {
		...last,
		startedAt: turns[0].startedAt,
		usage,
		apiCost: {
			...last.apiCost,
			usd: totals('usd'),
			minimumUsd: totals('minimumUsd'),
			maximumUsd: totals('maximumUsd')
		}
	};
}

function legacyExecution(result: NonNullable<ModuleTask['result']>) {
	return {
		provider: result.provider,
		model: result.model,
		intelligence: result.intelligence,
		reportedModel: result.reportedModel,
		usage: result.usage,
		apiCost: taskApiCost(result.reportedModel ?? result.model, result.usage),
		status: result.error ? ('failed' as const) : ('succeeded' as const),
		finishedAt: result.finishedAt
	};
}
