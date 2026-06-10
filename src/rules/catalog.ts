export interface HarnessRuleLimits {
	maxFileLines: number;
	maxFunctionLines: number;
	maxClassLines: number;
	maxMethodLines: number;
	maxNestingDepth: number;
	maxParameters: number;
	maxComplexity: number;
	maxClassesPerFile: number;
}

export const harnessRuleLimits: HarnessRuleLimits = {
	maxFileLines: 220,
	maxFunctionLines: 55,
	maxClassLines: 120,
	maxMethodLines: 35,
	maxNestingDepth: 4,
	maxParameters: 4,
	maxComplexity: 10,
	maxClassesPerFile: 1
} as const;

export const harnessRuleSummaries = harnessRuleSummariesFor(harnessRuleLimits);

export function harnessRuleSummariesFor(limits: HarnessRuleLimits): string[] {
	return [
		`Files stay at or below ${limits.maxFileLines} lines.`,
		`Functions stay at or below ${limits.maxFunctionLines} lines.`,
		`Classes stay at or below ${limits.maxClassLines} lines.`,
		`Methods stay at or below ${limits.maxMethodLines} lines.`,
		`Nesting stays at or below ${limits.maxNestingDepth} levels.`,
		`Functions and methods take at most ${limits.maxParameters} parameters.`,
		`Cyclomatic complexity stays at or below ${limits.maxComplexity}.`,
		`Each file defines at most ${limits.maxClassesPerFile} class.`,
		'Generated scaffold file names should keep the casing and suffixes prescribed by Harness.',
		'Function exports should use camelCase and generated function files should export the expected name.',
		'Classes should not use catch-all Manager names.',
		'Command modules delegate to workflows instead of importing templates or file-generation helpers.',
		'Core, template, workflow, and command imports move in one direction.',
		'Harness audit applies ecosystem adapters for app and library code surfaces.',
		'Unsupported file types must appear in audit coverage instead of being skipped silently.'
	];
}
