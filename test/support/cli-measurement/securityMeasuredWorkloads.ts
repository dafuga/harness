const reviewUnits = [
	'command.loop',
	'function.development-tooling-sibling-bug-sweep',
	'adapter.git'
];
const pinnedReviewUnits = [...reviewUnits, 'adapter.commit-tree'];

export const securityMeasuredWorkloads: Record<string, string[]> = {
	'loop:security:init': reviewUnits,
	'loop:security:scan': pinnedReviewUnits,
	'loop:security:revalidate': pinnedReviewUnits,
	'loop:security:revalidate:external': [
		...pinnedReviewUnits,
		'function.execution-runtimes-run-loop-evaluator-process'
	],
	'loop:security:prepare-repair': pinnedReviewUnits,
	'info:loop': ['guide.loop']
};

/** Keep subcommand names and the review method in measurement labels. */
export function cliWorkloadScope(args: string[]) {
	if (args[0] !== 'loop' || args[1] !== 'security')
		return args.slice(0, args[0] === 'plugin' && args[1] !== 'list' ? 3 : 2);
	const scope = args.slice(0, 3);
	if (args.includes('--reviewer')) scope.push('external');
	return scope;
}
