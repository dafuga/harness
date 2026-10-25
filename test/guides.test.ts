import { measureWorkload } from './support/measureWorkload';
import { harnessRuleLimits, harnessRuleSummariesFor } from '../src/rules/catalog';
import { expect, test } from 'vitest';
import { availableGuideTopics, findGuide, guides } from '../src/guides/guide';
import { scaffoldKinds } from '../src/templates/scaffoldTypes';
import { findGuideByTopic } from '../src/guides/topics';
import { scaffoldGuides } from '../src/guides/scaffolds';

test('model guidance is available for agents', () =>
	measureWorkload('guide.scaffolds', 'layout-catalog-behavior', () => {
		const guide = findGuide('model');

		expect(guide?.topic).toBe('model');
		expect(guide?.rules.join('\n')).toContain('Persisted data wrappers belong under Models');
		expect(guide?.rules.join('\n')).toContain('shared type modules belong under Types');
		expect(guide?.rules.join('\n')).toContain('Omit .types from displayed names');
		expect(guide?.exampleCommands[0]).toContain('harness generate model');
	}));

test('guidance covers every non-model scaffold topic', () =>
	measureWorkload('guide.guide', 'helper-source-category-guide', () => {
		const topics = new Set(guides.map((guide) => guide.topic));
		const generated = scaffoldGuides();
		const gameNames: Record<string, string> = {
			'game-view': '<camelName>ViewConfig.ts',
			mechanic: '<camelName>.ts',
			checkpoint: '<camelName>CheckpointConfig.ts'
		};

		for (const kind of scaffoldKinds) {
			expect(topics.has(kind), kind).toBe(true);
			expect(findGuide(kind)?.rules.join('\n'), kind).toContain('Naming:');
			expect(findGuide(kind)?.rules.join('\n'), kind).toContain(
				'General text helpers belong in Strings'
			);
			if (gameNames[kind])
				expect(findGuide(kind)?.rules.join('\n'), kind).toContain(gameNames[kind]);
			expect(generated.find((guide) => guide.topic === kind)?.rules.join('\n'), kind).toContain(
				'Test shape:'
			);
		}
	}));

test('code-rules guidance exposes hard Harness limits', () =>
	measureWorkload('function.catalog', 'helper-category-guidance', () => {
		expect(harnessRuleSummariesFor(harnessRuleLimits).join('\n')).toContain(
			'General text helpers belong in Strings'
		);
		const guide = findGuide('code-rules');
		for (const topic of ['view', 'page', 'code-rules']) {
			expect(findGuide(topic)?.rules.join('\n')).toContain(
				'Group related list, detail and history pages by feature'
			);
		}

		expect(guide?.rules.join('\n')).toContain('Functions stay at or below 55 lines');
		expect(guide?.rules.join('\n')).toContain('Classes stay at or below 120 lines');
		const naming = findGuide('naming');
		expect(naming?.rules.join('\n')).toContain('<PascalName>Service.ts');
		expect(naming?.rules.join('\n')).toContain('<PascalName>.svelte');
		expect(naming?.rules.join('\n')).toContain('<camelName>.ts');
		expect(naming?.rules.join('\n')).toContain('<PascalName>.types.ts');
		expect(findGuide('service')?.rules.join('\n')).toContain('instantiated classes');
	}));

test('loop guidance describes loop driven development', () => {
	const guide = findGuide('loop');

	expect(guide?.summary).toContain('drive, evaluate, and trace');
	expect(guide?.steps.join('\n')).toContain('Search templates');
	expect(guide?.rules.join('\n')).toContain('Project templates can extend one parent');
	expect(guide?.exampleCommands.join('\n')).toContain('harness loop create');
});

test('scaffold guidance tells agents what generated code contains', () =>
	measureWorkload('guide.scaffolds', 'scaffold-test-shape-guidance', () => {
		const catalog = findGuide('scaffolds');
		const mailer = findGuide('mailer');
		const catalogRules = () => catalog?.rules.join('\n') ?? '';
		const generatedRules = (topic: string) =>
			scaffoldGuides()
				.find((guide) => guide.topic === topic)
				?.rules.join('\n') ?? '';

		expect(catalog?.rules.join('\n')).toContain('mailer: Email rendering');
		expect(mailer?.contains?.join('\n')).toContain('Mailer class under src/mailers');
		expect(mailer?.exampleCommands[0]).toBe('harness generate mailer example');
		expect(findGuide('layout')?.rules.join(' ')).toContain('child-content slot');
		expect(findGuide('config')?.rules.join(' ')).toContain('audience and purpose');
		expect(findGuide('config')?.contains?.join(' ')).not.toContain('Name and enabled fields');
		expect(catalogRules()).toContain('Five standard test shapes');
		expect(catalogRules()).toContain(
			'Classes take class method-state cases; a pure function takes helper examples'
		);
		expect(catalogRules()).toContain(
			'mailer: Email rendering without delivery side effects. Test shape: class method-state cases.'
		);
		expect(catalogRules()).toContain('util: Tiny utility function. Test shape: map by behavior.');
		expect(catalogRules()).toContain('keeps the case count');
		expect(generatedRules('component')).toContain('Test shape: component screenshot match.');
		expect(generatedRules('component')).toContain('matching each committed baseline');
		expect(generatedRules('view')).toContain('Test shape: page screenshot match.');
		expect(generatedRules('helper')).toContain('must match the comment beside the example');
		expect(generatedRules('api')).toContain('every field and every error body');
		expect(generatedRules('feature')).toContain('Test shape: none.');
	}));

test('guide lookup accepts common scaffold aliases', () =>
	measureWorkload('guide.topics', 'guide-topic-lookup', () => {
		expect(findGuide('scaffold')?.topic).toBe('scaffolds');
		expect(findGuide('controllers')?.topic).toBe('controller');
		expect(findGuide('policies')?.topic).toBe('policy');
		expect(findGuide('code rules')?.topic).toBe('code-rules');
		for (const [entries, asked, canonical] of [
			[['scaffold', 'scaffolds'], 'scaffold', 'scaffold'],
			[['page', 'view'], 'page', 'page'],
			[['page', 'view'], 'pages', 'page'],
			[['pages', 'page', 'view'], 'pages', 'pages'],
			[['service', 'services'], 'services', 'services'],
			[['view'], 'PAGE', 'view'],
			[['view'], 'pages', 'view']
		] as const) {
			expect(
				findGuideByTopic(
					entries.map((topic) => ({ topic })),
					asked
				)?.topic,
				'Canonical topics precede aliases'
			).toBe(canonical);
		}
	}));

test('available guide topics are unique for CLI error output', () => {
	const topics = availableGuideTopics();

	expect(topics).toEqual([...new Set(topics)]);
	expect(topics.filter((topic) => topic === 'controller')).toHaveLength(1);
});
