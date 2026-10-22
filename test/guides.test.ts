import { expect, test } from 'vitest';
import { resolve } from 'node:path';
import { profilePublicEntry } from './support/taskProfiles';
import { availableGuideTopics, findGuide, guides } from '../src/guides/guide';
import { scaffoldKinds } from '../src/templates/scaffoldTypes';

test('model guidance is available for agents', () => {
	const guide = findGuide('model');

	expect(guide?.topic).toBe('model');
	expect(guide?.exampleCommands[0]).toContain('harness generate model');
});

test('guidance covers every non-model scaffold topic', () => {
	const topics = new Set(guides.map((guide) => guide.topic));

	for (const kind of scaffoldKinds) {
		expect(topics.has(kind), kind).toBe(true);
		expect(findGuide(kind)?.rules.join('\n'), kind).toContain('Naming:');
	}
});

test('code-rules guidance exposes hard Harness limits', () => {
	const guide = findGuide('code-rules');

	expect(guide?.rules.join('\n')).toContain('Functions stay at or below 55 lines');
	expect(guide?.rules.join('\n')).toContain('Classes stay at or below 120 lines');
	const naming = findGuide('naming');
	expect(naming?.rules.join('\n')).toContain('<PascalName>Service.ts');
	expect(naming?.rules.join('\n')).toContain('<PascalName>.svelte');
	expect(naming?.rules.join('\n')).toContain('<camelName>.ts');
	expect(naming?.rules.join('\n')).toContain('<PascalName>.types.ts');
	expect(findGuide('service')?.rules.join('\n')).toContain('instantiated classes');
});

test('loop guidance describes loop driven development', () => {
	const guide = findGuide('loop');

	expect(guide?.summary).toContain('drive, evaluate, and trace');
	expect(guide?.steps.join('\n')).toContain('Search templates');
	expect(guide?.rules.join('\n')).toContain('Project templates can extend one parent');
	expect(guide?.exampleCommands.join('\n')).toContain('harness loop create');
});

test('scaffold guidance tells agents what generated code contains', () => {
	const catalog = findGuide('scaffolds');
	const mailer = findGuide('mailer');

	expect(catalog?.rules.join('\n')).toContain('mailer: Email rendering');
	expect(mailer?.contains?.join('\n')).toContain('Mailer class under src/mailers');
	expect(mailer?.exampleCommands[0]).toBe('harness generate mailer example');
});

test('guide lookup accepts common scaffold aliases', () => {
	expect(findGuide('scaffold')?.topic).toBe('scaffolds');
	expect(findGuide('controllers')?.topic).toBe('controller');
	expect(findGuide('policies')?.topic).toBe('policy');
	expect(findGuide('code rules')?.topic).toBe('code-rules');
});

test('available guide topics are unique for CLI error output', () => {
	const topics = availableGuideTopics();

	expect(topics).toEqual([...new Set(topics)]);
	expect(topics.filter((topic) => topic === 'controller')).toHaveLength(1);
});

test.each([
	['console', 'consoleGuides'],
	['history', 'historyGuides'],
	['loop', 'loopGuide'],
	['runtimes', 'runtimeGuides'],
	['units', 'unitGuides'],
	['verification', 'verificationGuides']
])('the %s guide data cold-loads through its actual public entry', async (file, exported) => {
	const names = await profilePublicEntry(
		`guide.${file}`,
		resolve(import.meta.dirname, `../src/guides/${file}.ts`),
		[exported]
	);
	expect(names).toEqual([exported]);
});
