import { z } from 'zod';
import { test } from 'vitest';
import {
	moduleGroupConfig,
	moduleGroupsConfig,
	moduleGroupsFile
} from '../../src/configs/development-tooling/moduleGroupsConfig';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

function parseCase(
	schema: { parse(input: unknown): unknown },
	name: string,
	input: unknown
) {
	try {
		return { name, input, output: schema.parse(input) };
	} catch (error) {
		if (!(error instanceof z.ZodError)) throw error;
		return {
			name,
			input,
			error: error.issues.map((issue) => {
				const path = issue.path.length > 0 ? issue.path.join('.') : 'record';
				return `${path}: ${issue.message}`;
			})
		};
	}
}

function issueMessages(example: Parameters<typeof recordExampleCases>[1][number]): string[] {
	return Array.isArray(example.error)
		? example.error.filter((message): message is string => typeof message === 'string')
		: [];
}

function issuePaths(example: Parameters<typeof recordExampleCases>[1][number]): string[] {
	return issueMessages(example).map((message) => message.slice(0, message.indexOf(':')));
}

test('Parses module group values and the canonical filename', () => {
	const withRoute = parseCase(moduleGroupConfig, 'a titled group with search terms and a route', {
		id: 'product-help',
		title: '  Product help  ',
		terms: [' support ', 'billing'],
		folders: ['apps/web/src/routes/help/']
	});
	const defaults = parseCase(moduleGroupConfig, 'a group with optional terms and folders omitted', {
		id: 'guide-pages',
		title: ' Guides '
	});

	expect(withRoute.output).toEqual({
		id: 'product-help',
		title: 'Product help',
		terms: ['support', 'billing'],
		folders: ['apps/web/src/routes/help/']
	});
	expect(defaults.output).toEqual({ id: 'guide-pages', title: 'Guides', terms: [] });
	expect(moduleGroupsFile).toBe('harness.groups.json');
	recordExampleCases(
		{
			unitId: 'config.module-groups',
			symbol: 'moduleGroupConfig',
			state: 'parses-module-group-values-and-the-canonical-filename',
			evidence: 'examples-cases',
			file: 'parses-module-group-values-and-the-canonical-filename.json'
		},
		[withRoute, defaults]
	);
});

test('Parses module groups with explicit and default legacy paths', () => {
	const groups = [
		{
			id: 'customer-help',
			title: 'Customer help',
			terms: ['support'],
			folders: ['apps/web/src/routes/help/']
		}
	];
	const retained = parseCase(moduleGroupsConfig, 'a migration with an exact legacy entry', {
		schemaVersion: 1,
		groups,
		legacy: ['apps/web/src/routes/legacy-help.ts']
	});
	const defaults = parseCase(moduleGroupsConfig, 'a config without legacy entries', {
		schemaVersion: 1,
		groups
	});

	expect(retained.output).toEqual({
		schemaVersion: 1,
		groups,
		legacy: ['apps/web/src/routes/legacy-help.ts']
	});
	expect(defaults.output).toEqual({ schemaVersion: 1, groups, legacy: [] });
	recordExampleCases(
		{
			unitId: 'config.module-groups',
			symbol: 'moduleGroupsConfig',
			state: 'parses-module-groups-with-explicit-and-default-legacy-paths',
			evidence: 'examples-cases',
			file: 'parses-module-groups-with-explicit-and-default-legacy-paths.json'
		},
		[retained, defaults]
	);
});

test('Rejects invalid module group ids and required text', () => {
	const invalid = [
		parseCase(moduleGroupConfig, 'the reserved uncategorized id', {
			id: 'uncategorized',
			title: 'General'
		}),
		parseCase(moduleGroupConfig, 'an id with uppercase letters', {
			id: 'Product-help',
			title: 'Product help'
		}),
		parseCase(moduleGroupConfig, 'a title that is empty after trimming', {
			id: 'product-help',
			title: '   '
		}),
		parseCase(moduleGroupConfig, 'a search term that is empty after trimming', {
			id: 'product-help',
			title: 'Product help',
			terms: ['   ']
		})
	];

	expect(invalid.map(issuePaths)).toEqual([['id'], ['id'], ['title'], ['terms.0']]);
	recordExampleCases(
		{
			unitId: 'config.module-groups',
			symbol: 'moduleGroupConfig',
			state: 'rejects-invalid-module-group-ids-and-required-text',
			evidence: 'examples-cases',
			file: 'rejects-invalid-module-group-ids-and-required-text.json'
		},
		invalid
	);
});

test('Rejects unsafe module group route folders', () => {
	const folders = [
		'apps/web/routes/help/',
		'apps/web/src/routes/help',
		'apps/web/src/routes/../admin/',
		'apps/web/src/routes/admin\\index/'
	];
	const invalid = folders.map((folder) =>
		parseCase(moduleGroupConfig, `route folder ${folder}`, {
			id: 'route-pages',
			title: 'Route pages',
			folders: [folder]
		})
	);

	expect(invalid.map(issuePaths)).toEqual([
		['folders.0'],
		['folders.0'],
		['folders.0'],
		['folders.0']
	]);
	recordExampleCases(
		{
			unitId: 'config.module-groups',
			symbol: 'moduleGroupConfig',
			state: 'rejects-unsafe-module-group-route-folders',
			evidence: 'examples-cases',
			file: 'rejects-unsafe-module-group-route-folders.json'
		},
		invalid
	);
});

test('Rejects invalid metadata, duplicate ids, and legacy paths', () => {
	const group = { id: 'product-help', title: 'Product help' };
	const duplicate = parseCase(moduleGroupsConfig, 'duplicate category ids', {
		schemaVersion: 1,
		groups: [group, { ...group, title: 'Help center' }]
	});
	const version = parseCase(moduleGroupsConfig, 'a schema version other than one', {
		schemaVersion: 2,
		groups: []
	});
	const extra = parseCase(moduleGroupsConfig, 'an unknown config field', {
		schemaVersion: 1,
		groups: [],
		description: 'not part of the config schema'
	});
	const unsafeLegacy = parseCase(moduleGroupsConfig, 'legacy paths with traversal and a backslash', {
		schemaVersion: 1,
		groups: [],
		legacy: ['../legacy.ts', 'apps/web/src/routes\\legacy.ts']
	});

	expect(issueMessages(duplicate).some((message) => message.includes('Category ids must be unique.'))).toBe(
		true
	);
	expect(issuePaths(version)).toEqual(['schemaVersion']);
	expect(issueMessages(extra).length).toBeGreaterThan(0);
	expect(issueMessages(unsafeLegacy).length).toBe(2);
	recordExampleCases(
		{
			unitId: 'config.module-groups',
			symbol: 'moduleGroupsConfig',
			state: 'rejects-invalid-metadata-duplicate-ids-and-legacy-paths',
			evidence: 'examples-cases',
			file: 'rejects-invalid-metadata-duplicate-ids-and-legacy-paths.json'
		},
		[duplicate, version, extra, unsafeLegacy]
	);
});
