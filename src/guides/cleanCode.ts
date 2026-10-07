import type { Guide } from './guide';

export const cleanCodeGuide: Guide = {
	topic: 'clean-code',
	summary: 'Review source files against language-aware Clean Code principles using Jev.',
	steps: [
		'Preview coverage with harness audit . --clean-code --dry-run --json.',
		'Set HARNESS_JEV_API_KEY to a credential dedicated to this project, or configure cleanCode.apiKeyEnv.',
		'Run an advisory review and assess findings and uncertainty before enabling the gate.',
		'Use cleanCode.mode in harness.audit.json or --gate to enforce confident violations.',
		'Use harness audit . --clean-code --gate as an evaluator in an existing loop.',
		'Install automatic local Codex checks with harness session install --root <projects> --credential-file <private-env> --bundle dist/index.js, then review and trust the hook in /hooks.'
	],
	rules: [
		'Normal audits stay offline when cleanCode.mode is off.',
		'Automatic session checks are advisory background reviews at startup/resume; they use the explicitly selected checker credential and report incomplete execution honestly.',
		'Confident violations fail only in gate mode; uncertainty is a non-blocking review item.',
		'Incomplete execution exits 2; rule violations exit 1; non-blocking completion exits 0.',
		'Review every supported source language with bounded imports, matching tests, and conventions.',
		'Exclusions accept exact paths, directory prefixes ending in /, and *, **, ? patterns.',
		'Pin the model for reproducibility; aliases bypass caching. Use --refresh to rerun cached judgments.',
		'Jev supplies judgments; Harness supplies predefined guidance and source-grounded locations.'
	],
	antiPatterns: [
		'Do not call uncertain or incomplete assessments clean.',
		'Do not treat mocked integration tests as evidence of live review accuracy.',
		'Do not store API keys in harness.audit.json or reuse another project credential.'
	],
	exampleCommands: [
		'harness audit . --clean-code --dry-run',
		'harness audit . --clean-code --json',
		'harness audit . --clean-code --gate --refresh'
	]
};
