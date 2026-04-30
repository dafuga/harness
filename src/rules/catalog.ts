export const harnessRuleLimits = {
	maxFileLines: 220,
	maxFunctionLines: 55,
	maxClassLines: 120,
	maxMethodLines: 35,
	maxNestingDepth: 4,
	maxParameters: 4,
	maxComplexity: 10,
	maxClassesPerFile: 1
} as const;

export const harnessRuleSummaries = [
	`Files stay at or below ${harnessRuleLimits.maxFileLines} lines.`,
	`Functions stay at or below ${harnessRuleLimits.maxFunctionLines} lines.`,
	`Classes stay at or below ${harnessRuleLimits.maxClassLines} lines.`,
	`Methods stay at or below ${harnessRuleLimits.maxMethodLines} lines.`,
	`Nesting stays at or below ${harnessRuleLimits.maxNestingDepth} levels.`,
	`Functions and methods take at most ${harnessRuleLimits.maxParameters} parameters.`,
	`Cyclomatic complexity stays at or below ${harnessRuleLimits.maxComplexity}.`,
	`Each file defines at most ${harnessRuleLimits.maxClassesPerFile} class.`,
	'Generated scaffold file names should keep the casing and suffixes prescribed by Harness.',
	'Function exports should use camelCase and generated function files should export the expected name.',
	'Classes should not use catch-all Manager names.',
	'Command modules delegate to workflows instead of importing templates or file-generation helpers.',
	'Core, template, workflow, and command imports move in one direction.',
	'Harness audit applies ecosystem adapters for app and library code surfaces.',
	'Unsupported file types must appear in audit coverage instead of being skipped silently.'
] as const;
