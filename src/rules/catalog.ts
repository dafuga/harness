export const frameRuleLimits = {
	maxFileLines: 220,
	maxFunctionLines: 55,
	maxClassLines: 120,
	maxMethodLines: 35,
	maxNestingDepth: 4,
	maxParameters: 4,
	maxComplexity: 10,
	maxClassesPerFile: 1
} as const;

export const frameRuleSummaries = [
	`Files stay at or below ${frameRuleLimits.maxFileLines} lines.`,
	`Functions stay at or below ${frameRuleLimits.maxFunctionLines} lines.`,
	`Classes stay at or below ${frameRuleLimits.maxClassLines} lines.`,
	`Methods stay at or below ${frameRuleLimits.maxMethodLines} lines.`,
	`Nesting stays at or below ${frameRuleLimits.maxNestingDepth} levels.`,
	`Functions and methods take at most ${frameRuleLimits.maxParameters} parameters.`,
	`Cyclomatic complexity stays at or below ${frameRuleLimits.maxComplexity}.`,
	`Each file defines at most ${frameRuleLimits.maxClassesPerFile} class.`,
	'Classes should not use catch-all Manager names.',
	'Command modules delegate to workflows instead of importing templates or file-generation helpers.',
	'Core, template, workflow, and command imports move in one direction.'
] as const;
