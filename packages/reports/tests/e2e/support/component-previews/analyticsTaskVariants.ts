import type { Jev } from '../../../../src/components/reports-media/AnalyticsTasks.types';
import type { PreviewCases } from './shared';

/** Distinct task outcomes retain the real Analytics Tasks input shape. */
export function analyticsTaskVariant(props: PreviewCases[string], variant: string) {
	const jev = props.jev as Jev;
	const example = jev.response.tasks[0];
	const outcomes = {
		unassessed: { task: 'Review component preview', attempts: 0, attemptsToPass: null },
		unpassed: { task: 'Repair component preview', attempts: 2, attemptsToPass: null },
		retried: {
			task: 'Verify component preview',
			attempts: 3,
			attemptsToPass: 3,
			report: 'preview-report'
		}
	};
	const outcome = outcomes[variant as keyof typeof outcomes];
	if (!outcome) return null;
	const task = { ...example, ...outcome, firstPassed: false };
	return {
		...props,
		jev: {
			...jev,
			response: { ...jev.response, tasks: [task] },
			cleanCode: { ...jev.cleanCode, tasks: [] }
		}
	};
}
