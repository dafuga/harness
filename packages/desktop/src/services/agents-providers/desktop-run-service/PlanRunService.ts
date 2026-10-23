import type { RunContext } from '../../../models/development-tooling/RunContext.types';
import { runContext } from '../../../utils/development-tooling/runContext';
import { sourceSnapshot } from '../../../utils/verification-evidence/sourceSnapshot';
import { sourceChanges } from '../../../utils/development-tooling/sourceChanges';
import { planDesign } from '../../../utils/planning-collaboration/plan-design/planDesign';
export class PlanRunService {
	async run(context: RunContext) {
		const { request, runner, signal, emit, id } = context;
		emit({
			runId: id,
			kind: 'status',
			phase: 'prompting',
			detail: 'Preparing the design with ' + request.provider + ' / ' + request.model
		});
		const before = await sourceSnapshot(context.root);
		const result = await runner.run({
			model: request.model,
			effort: request.effort,
			cwd: context.root,
			prompt:
				(await runContext(context)) +
				'\nPlan only. Return a precise design prompt or headless behavior proposal. Do not write project source.',
			access: 'read-only',
			signal,
			onText: (text) => emit({ runId: id, kind: 'text', text }),
			onStatus: () => {}
		});
		if (sourceChanges(before, await sourceSnapshot(context.root)).length)
			throw new Error(
				'The Plan agent changed project files. The changes remain recoverable; no design was approved.'
			);
		return planDesign(context, result.text);
	}
}
