import { test } from 'vitest';
import {
	explorerRoute,
	explorerRoutePath,
	type ExplorerLocation
} from '../../src/utils/explorerRoute';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const unitId = 'function.explorer-route';
const sha = 'a'.repeat(40);
const main = (fields: Partial<ExplorerLocation>) =>
	({ branch: 'main', commit: null, ...fields }) as ExplorerLocation;
const pinned = (fields: Partial<ExplorerLocation>) =>
	({ branch: 'main', commit: sha, ...fields }) as ExplorerLocation;
const slugify = { category: 'functions', entity: 'function.slugify' } as const;
const kebab = { category: 'functions', helper: 'toKebabCase' } as const;
const kase = { ...kebab, entity: 'function.case' } as const;
const fnPath = '/branch/main/functions/function.slugify';
const cardPath = '/branch/main/components/card';
const pagePath = '/branch/main/pages/page.orders';
const helperPath = '/branch/main/helpers/toKebabCase/in/function.case';

function parseRows(
	state: string,
	rows: readonly (readonly [string, string, string, ExplorerLocation | undefined])[]
): void {
	const cases = rows.map(([name, path, search]) => ({
		name,
		input: { path, search },
		output: explorerRoute(path, search)
	}));
	expect(cases.map((item) => item.output)).toEqual(rows.map((row) => row[3]));
	recordExampleCases(
		{ unitId, symbol: 'explorerRoute', state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

function serializeRows(
	state: string,
	rows: readonly (readonly [string, ExplorerLocation, string])[]
): void {
	const cases = rows.map(([name, input]) => {
		try {
			return { name, input, output: explorerRoutePath(input) };
		} catch (error) {
			return { name, input, error: (error as Error).name };
		}
	});
	expect(cases.map((item) => ('error' in item ? item.error : item.output))).toEqual(
		rows.map((row) => row[2])
	);
	recordExampleCases(
		{
			unitId,
			symbol: 'explorerRoutePath',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

const scopeRows = [
	[
		'current branch function details',
		'/branch/feature%2Fkept%231/functions/function.slugify/details',
		'',
		main({ branch: 'feature/kept#1', ...slugify, section: 'details' })
	],
	[
		'pinned commit function history',
		`/branch/main/commit/${sha}/functions/function.slugify/history`,
		'',
		pinned({ ...slugify, section: 'history' })
	],
	[
		'commit without branch keeps a config entity',
		`/commit/${sha}/configs/config.site`,
		'',
		{ branch: null, commit: sha, category: 'configs', entity: 'config.site' }
	],
	[
		'module screen takes its entity from the second segment',
		'/branch/main/plugins/email',
		'',
		main({ category: 'pages', screen: 'modules', entity: 'email' })
	]
] as const;

const queryRows = [
	[
		'function examples tab from query',
		fnPath,
		'?tab=examples',
		main({ ...slugify, tab: 'examples' })
	],
	[
		'pinned details source tab is kept',
		`/branch/main/commit/${sha}/functions/function.slugify/details`,
		'?tab=source',
		pinned({ ...slugify, section: 'details', tab: 'source' })
	],
	['models tab is dropped on a function', fnPath, '?tab=models', main(slugify)],
	['states tab is dropped on a function', fnPath, '?tab=states', main(slugify)],
	[
		'states tab is kept on a component',
		cardPath,
		'?tab=states',
		main({ category: 'components', entity: 'card', tab: 'states' })
	],
	[
		'category index with trailing slash keeps no tab',
		'/branch/main/functions/',
		'?tab=examples',
		main({ category: 'functions' })
	],
	[
		'legacy page contract opens models',
		pagePath,
		'?tab=contract',
		main({ category: 'pages', entity: 'page.orders', tab: 'models' })
	],
	[
		'helper and tab selected by query',
		fnPath,
		'?helper=toKebabCase&tab=examples',
		main({ ...slugify, helper: 'toKebabCase', tab: 'examples' })
	],
	[
		'helper query is ignored on a component',
		cardPath,
		'?helper=wrong',
		main({ category: 'components', entity: 'card' })
	]
] as const;

const helperRows = [
	[
		'helper with owner and contract pane',
		`${helperPath}/contract`,
		'',
		main({ ...kase, tab: 'contract' })
	],
	[
		'pinned helper with owner and history pane',
		`/branch/main/commit/${sha}/helpers/toKebabCase/in/function.case/history`,
		'',
		pinned({ ...kase, section: 'history' })
	],
	['readable helper alone', '/branch/main/helpers/toKebabCase', '', main(kebab)]
] as const;

const rejectRows = [
	['empty path names nothing', '', '', undefined],
	['bare category without scope', '/pages', '', undefined],
	['branch name is not percent-decodable', '/branch/%E0%A4%A/pages', '', undefined],
	['short commit is not a full hash', '/branch/main/commit/abc/pages', '', undefined],
	[
		'uppercase commit is not a full hash',
		`/branch/main/commit/${sha.toUpperCase()}/pages`,
		'',
		undefined
	],
	['unknown category under a commit', `/branch/main/commit/${sha}/map`, '', undefined],
	['branch name runs into the category', '/branch/feature/kept/pages', '', undefined],
	['source is not a section', '/branch/main/pages/x/source', '', undefined],
	['extra segment after details', '/branch/main/pages/x/details/extra', '', undefined],
	['screen takes no section', '/branch/main/dependencies/history', '', undefined],
	['platform takes no section', '/branch/main/platforms/x/history', '', undefined],
	['helper pane must be known', '/branch/main/helpers/toKebabCase/bogus', '', undefined],
	['helper owner must be named', '/branch/main/helpers/toKebabCase/in', '', undefined],
	['module entity must start lowercase', '/branch/main/plugins/Email', '', undefined]
] as const;

const serializeInputs = [
	[
		'function details become the contract tab',
		main({ ...slugify, section: 'details' }),
		`${fnPath}?tab=contract`
	],
	[
		'pinned helper with a contract pane',
		pinned({ ...kase, tab: 'contract' }),
		`/branch/main/commit/${sha}/helpers/toKebabCase/in/function.case/contract`
	],
	[
		'helper history pane is a path segment',
		main({ ...kase, section: 'history' }),
		`${helperPath}/history`
	],
	[
		'pinned styles screen has no branch',
		{ branch: null, commit: sha, category: 'pages', screen: 'styles' },
		`/commit/${sha}/styles`
	],
	[
		'module resource screen keeps its entity',
		main({ category: 'pages', screen: 'module-resources', entity: 'email.email' }),
		'/branch/main/module-resources/email.email'
	],
	['unpaired surrogate throws a URIError', main({ ...slugify, entity: '\uD800' }), 'URIError']
] as const;

test('Explorer route reads current and pinned scopes with category, entity and section', () =>
	parseRows('explorer-route-parse-scopes', scopeRows));

test('Explorer route keeps only eligible query tabs and a helper selected by query', () =>
	parseRows('explorer-route-retain-query-tabs', queryRows));

test('Explorer route reads helper panes as path segments and qualified owners', () =>
	parseRows('explorer-route-helper-child-paths', helperRows));

test('Explorer route rejects malformed and unknown addresses', () =>
	parseRows('explorer-route-reject-malformed', rejectRows));

test('Explorer route path serializes canonical scoped addresses and rejects unpaired surrogates', () =>
	serializeRows('explorer-route-serialize-canonical', serializeInputs));
