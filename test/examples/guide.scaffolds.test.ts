import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { scaffoldGuides, scaffoldsGuide, namingGuide } from '../../src/guides/development-tooling/scaffolds';

test('Lists one guide per scaffold kind with its contains list', () => {
	const guides = scaffoldGuides();
	const mailer = guides.find((guide) => guide.topic === 'mailer') as (typeof guides)[number];
	expect(guides.length).toBeGreaterThan(0);
	expect(mailer.summary).toBe('Email rendering without delivery side effects.');
	expect(mailer.exampleCommands).toEqual(['harness generate mailer example']);
	expect(mailer.contains).toContain('Mailer class under src/mailers.');
	expect(mailer.rules).toContain('This scaffold is package-safe.');

	recordExampleCases(
		{
			unitId: 'guide.scaffolds',
			symbol: 'scaffoldGuides',
			state: 'lists-one-guide-per-scaffold-kind-with-its-contains-list',
			evidence: 'examples-cases',
			file: 'lists-one-guide-per-scaffold-kind-with-its-contains-list.json'
		},
		[
			{
				name: 'one guide per scaffold kind',
				input: [],
				output: { count: guides.length, topics: guides.map((guide) => guide.topic) }
			},
			{
				name: 'mailer guide summary fields',
				input: [],
				output: {
					topic: mailer.topic,
					summary: mailer.summary,
					exampleCommands: mailer.exampleCommands,
					contains: mailer.contains
				}
			}
		]
	);
});

test('Summarises the scaffold catalog index', () => {
	const guide = scaffoldsGuide();
	expect(guide.topic).toBe('scaffolds');
	expect(guide.rules).toContain('service: Workflow logic with one reason to change.');
	expect(guide.rules).toContain('component: Reusable Svelte UI component. App-only.');
	expect(guide.rules).toContain('mailer: Email rendering without delivery side effects.');
	expect(guide.exampleCommands).toEqual(['harness info scaffolds', 'harness info mailer --json']);

	recordExampleCases(
		{
			unitId: 'guide.scaffolds',
			symbol: 'scaffoldsGuide',
			state: 'summarises-the-scaffold-catalog-index',
			evidence: 'examples-cases',
			file: 'summarises-the-scaffold-catalog-index.json'
		},
		[{ name: 'catalog index guide', input: [], output: guide }]
	);
});

test('Lists canonical source names for every module type', () => {
	const guide = namingGuide();
	expect(guide.topic).toBe('naming');
	expect(guide.rules).toContain(
		'Naming: Components use <PascalName>.svelte and the same PascalCase import name.'
	);
	expect(guide.rules).toContain('Naming: Unit tests use <kebab-name>.test.ts.');
	expect(guide.exampleCommands).toContain('harness audit .');

	recordExampleCases(
		{
			unitId: 'guide.scaffolds',
			symbol: 'namingGuide',
			state: 'lists-canonical-source-names-for-every-module-type',
			evidence: 'examples-cases',
			file: 'lists-canonical-source-names-for-every-module-type.json'
		},
		[{ name: 'naming guide', input: [], output: guide }]
	);
});
