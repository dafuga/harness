import type { Guide } from '../development-tooling/guide';

export const benchmarkGuide: Guide = {
	topic: 'benchmark',
	summary: 'Compare explicit subagent configurations against pinned component contracts.',
	steps: [
		'Define version 1 JSON with task, contract, allowedFiles, checks and candidates.',
		'Validate runner availability and preview the pinned revision and trial matrix.',
		'Run sequential trials; read first-submission and bounded-repair results separately.',
		'Use benchmark results or analytics benchmarks for durable local evidence.'
	],
	rules: [
		'Paths are exact project-relative implementation files; everything else is protected.',
		'Checks are visible and restored from the pinned commit for every evaluation.',
		'Default: three repetitions, fifteen minutes per trial and two repair submissions.',
		'Explicitly choose model and effort; unsupported configurations never fall back.',
		'Missing usage stays unknown; reported cost estimates are not subscription charges.',
		'Only benchmark trusted repositories and commands; workspaces are not OS sandboxes.'
	],
	antiPatterns: ['Do not rank speed without correctness or mix different contract fingerprints.'],
	exampleCommands: [
		'harness benchmark validate benchmark.json',
		'harness benchmark run benchmark.json --seed comparison-1 --json',
		'harness benchmark results <run-id> --json',
		'harness analytics benchmarks --json'
	]
};
