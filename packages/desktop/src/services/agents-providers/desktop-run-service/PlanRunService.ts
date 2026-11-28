// @harness-uid u_vw6hylhmj7
import type { RunContext } from '../../../models/development-tooling/RunContext.types';
import { PlanAgentChangedProjectFilesError } from './PlanRunService.types';
import { runContext } from '../../../utils/projects-sessions/runContext';
import { sourceSnapshot } from '../../../utils/verification-evidence/sourceSnapshot';
import { sourceChanges } from '../../../utils/git-source-history/sourceChanges';
import { planDesign } from '../../../utils/planning-collaboration/plan-design/planDesign';
import { visualPlan } from '../../../utils/planning-collaboration/mockupPlan';
import { mockModePlanningRule } from '../../../../../../src/utils/agents-providers/mockModePlanningRule';
export class PlanRunService {
	async run(context: RunContext) {
		if (visualPlan(context.entity.category)) return planDesign(context, await runContext(context));
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
			prompt: [
				await runContext(context),
				'Plan only. Return a precise behavior proposal. Do not write project source.',
				mockModePlanningRule
			].join('\n'),
			access: 'read-only',
			signal,
			onText: (text) => emit({ runId: id, kind: 'text', text }),
			onStatus: () => {}
		});
		if (sourceChanges(before, await sourceSnapshot(context.root)).length)
			throw new PlanAgentChangedProjectFilesError(
				'The Plan agent changed project files. The changes remain recoverable; no design was approved.'
			);
		return planDesign(context, result.text);
	}
}
