import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { Outcome } from './desktop.service.project-task.test.types';

const UNIT = 'desktop.service.project-task';

export function recordCases(
	state: string,
	cases: Array<{ name: string; input: unknown } & Outcome>
) {
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'ProjectTaskService.run',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

export async function outcome(run: Promise<unknown>): Promise<Outcome> {
	try {
		return { output: await run };
	} catch (error) {
		return { error: (error as Error).message };
	}
}
