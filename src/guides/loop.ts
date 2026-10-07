import type { Guide } from './guide';

export const loopGuide: Guide = {
	topic: 'loop',
	summary: 'Use inherited loop templates to drive, evaluate, and trace agent work.',
	steps: [
		'Search templates and existing loops before choosing the work loop.',
		'Create the loop from a built-in or project template with the human-facing goal.',
		'Use next-step guidance to keep work aligned with inherited steps and evaluators.',
		'Complete steps with concrete evidence such as tests, browser checks, screenshots, or deployment proof.',
		'Run loop evaluators as a repeatable proof layer, not as a substitute for judgment.'
	],
	rules: [
		'Built-in loops cover feature, fix, bug-fix, regression-prevention, refactor, and visual-change work.',
		'Choose bug-fix for failing-test-first repairs; choose regression-prevention for root-cause repairs with enforced guards.',
		'Record failing and passing proof from the same unchanged regression test; retry repairs and keep verification pending while checks fail.',
		'For prevention, wire the guard into normal verification and prove reintroducing the original failure makes it fail in isolation, then restore and prove it passes.',
		'Agents perform retries; Harness evaluators do not launch an AI runner or automatically complete steps.',
		'For affected UI flows, exercise the browser and capture fresh inspected screenshots.',
		'Project templates can extend one parent loop and override steps by id.',
		'Normal tests, browser checks, audit, build, and deployment proof remain source of truth.'
	],
	antiPatterns: [
		'Do not make vague steps like "finish feature".',
		'Do not mark a step complete without concrete evidence.'
	],
	exampleCommands: [
		'harness loop search feature',
		'harness loop create newsletter-signup --from feature --goal "Visitors can subscribe"',
		'harness loop next newsletter-signup',
		'harness loop evaluate newsletter-signup'
	]
};
