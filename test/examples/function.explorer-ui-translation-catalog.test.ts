import type { Units, Tree, Entry } from './function.explorer-ui-translation-catalog.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { translationCatalog } from '../../src/services/explorer-ui/revision-detail-service/translationCatalog';
import { flattenMessages, translationMessages } from '../../src/services/explorer-ui/revision-detail-service/translationMessages';
import type { TranslationSource } from '../../src/services/explorer-ui/revision-detail-service/translationMessages.types';

const UNIT_ID = 'reports.component.evidence-grid';
const DISK_ERROR = 'disk unavailable';
const NOT_OBJECT = 'Dictionary must be an object.';

const revision = { revision: { title: 'Revision', empty: '' }, status: 'Ready' };
const changes = { changes: { count: '{count, plural, one {# change} other {# changes}}' } };
const staticText =
	"import { addMessages } from 'svelte-i18n';\nconst fr = { revision: { title: 'Révision' } };\naddMessages('fr', fr);\n";
const dynamicText =
	"import { addMessages } from 'svelte-i18n';\nimport { locale } from './state';\n\naddMessages(locale, { revision: { title: 'Révision' } });\n";

const reportFiles = {
	'src/components/reports/revision.ts':
		"import { addMessages } from 'svelte-i18n';\naddMessages('en', { revision: { title: 'Revision' } });\naddMessages('fr', { revision: { title: 'Révision' } });\n",
	'src/components/reports/EvidenceGrid.svelte': "<h2>{$t('revision.title')}</h2>\n"
};

const units = [
	{ id: UNIT_ID, owns: { source: ['src/components/reports/EvidenceGrid.svelte'] } }
] as Units;

/** Builds an in-memory SourceTree; reading `failing` rejects with DISK_ERROR. */
function fakeTree(files: Record<string, string>, failing = ''): Tree {
	return {
		revision: 'fixture-revision',
		list: async () => Object.keys(files).map((path) => ({ path }) as Entry),
		read: async (path: string) => {
			if (path === failing) throw new Error(DISK_ERROR);
			return files[path] ?? '';
		}
	};
}

function thrownMessage(run: () => unknown): string {
	try {
		run();
		return '';
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

function sourceSummary(source: TranslationSource) {
	return {
		locales: source.registrations.map((registration) => registration.locale),
		keys: source.keys,
		gaps: source.gaps
	};
}

test('Flattens nested messages and keeps empty strings', () => {
	const flat = flattenMessages(revision);
	const prefixed = flattenMessages(changes, 'explorer.revision');
	expect(flat).toEqual({ 'revision.title': 'Revision', 'revision.empty': '', status: 'Ready' });
	expect(prefixed).toEqual({
		'explorer.revision.changes.count': '{count, plural, one {# change} other {# changes}}'
	});
	recordExampleCases(
		{
			unitId: 'function.explorer-ui-translation-catalog',
			symbol: 'flattenMessages',
			state: 'flattens-nested-messages-and-keeps-empty-strings',
			evidence: 'examples-cases',
			file: 'flattens-nested-messages-and-keeps-empty-strings.json'
		},
		[
			{ name: 'nested revision dictionary with an empty string', input: revision, output: flat },
			{
				name: 'plural dictionary under the explorer.revision prefix',
				input: { prefix: 'explorer.revision', dictionary: changes },
				output: prefixed
			}
		]
	);
});

test('Rejects dictionaries that are not objects', () => {
	const nullError = thrownMessage(() => flattenMessages(null));
	const arrayError = thrownMessage(() => flattenMessages(['Ready']));
	const nestedError = thrownMessage(() => flattenMessages({ status: { label: 1 } }));
	expect([nullError, arrayError, nestedError]).toEqual([NOT_OBJECT, NOT_OBJECT, NOT_OBJECT]);
	recordExampleCases(
		{
			unitId: 'function.explorer-ui-translation-catalog',
			symbol: 'flattenMessages',
			state: 'rejects-dictionaries-that-are-not-objects',
			evidence: 'examples-cases',
			file: 'rejects-dictionaries-that-are-not-objects.json'
		},
		[
			{ name: 'null dictionary', input: null, error: nullError },
			{ name: 'array dictionary', input: ['Ready'], error: arrayError },
			{ name: 'nested number value', input: { status: { label: 1 } }, error: nestedError }
		]
	);
});

test('Reads static addMessages registrations and keys', () => {
	const source = translationMessages(staticText);
	expect(source.registrations.map((registration) => registration.locale)).toEqual(['fr']);
	expect(source.gaps).toEqual([]);
	recordExampleCases(
		{
			unitId: 'function.explorer-ui-translation-catalog',
			symbol: 'translationMessages',
			state: 'reads-static-addmessages-registrations-and-keys',
			evidence: 'examples-cases',
			file: 'reads-static-addmessages-registrations-and-keys.json'
		},
		[
			{
				name: 'fr dictionary declared as a constant',
				input: { text: staticText },
				output: sourceSummary(source)
			}
		]
	);
});

test('Records a non-static locale as a gap', () => {
	const source = translationMessages(dynamicText);
	expect(source.gaps.length).toBeGreaterThan(0);
	recordExampleCases(
		{
			unitId: 'function.explorer-ui-translation-catalog',
			symbol: 'translationMessages',
			state: 'records-a-non-static-locale-as-a-gap',
			evidence: 'examples-cases',
			file: 'records-a-non-static-locale-as-a-gap.json'
		},
		[
			{
				name: 'locale imported from a state module',
				input: { text: dynamicText },
				output: sourceSummary(source)
			}
		]
	);
});

test('Catalog rows list the units that call each key', async () => {
	const catalog = await translationCatalog(fakeTree(reportFiles), units);
	const bare = await translationCatalog(fakeTree(reportFiles));
	const rows = catalog.rows.map((row) => ({ key: row.key, values: row.values, usedBy: row.usedBy }));
	expect(catalog.locales).toEqual(['en', 'fr']);
	expect(rows).toEqual([
		{
			key: 'revision.title',
			values: { en: 'Revision', fr: 'Révision' },
			usedBy: [UNIT_ID]
		}
	]);
	expect(catalog.gaps).toEqual([]);
	expect(bare.rows.map((row) => row.usedBy)).toEqual([[]]);
	recordExampleCases(
		{
			unitId: 'function.explorer-ui-translation-catalog',
			symbol: 'translationCatalog',
			state: 'catalog-rows-list-the-units-that-call-each-key',
			evidence: 'examples-cases',
			file: 'catalog-rows-list-the-units-that-call-each-key.json'
		},
		[
			{
				name: 'two locales for one key used by a registered unit',
				input: { files: Object.keys(reportFiles), units: [UNIT_ID] },
				output: { locales: catalog.locales, rows, gaps: catalog.gaps }
			},
			{
				name: 'same sources with no registered units',
				input: { files: Object.keys(reportFiles), units: [] },
				output: { usedBy: bare.rows.map((row) => row.usedBy) }
			}
		]
	);
});

test('Rejects the whole catalog when a source read fails', async () => {
	const failing = 'src/components/reports/EvidenceGrid.svelte';
	await expect(translationCatalog(fakeTree(reportFiles, failing), units)).rejects.toThrow(
		DISK_ERROR
	);
	recordExampleCases(
		{
			unitId: 'function.explorer-ui-translation-catalog',
			symbol: 'translationCatalog',
			state: 'rejects-the-whole-catalog-when-a-source-read-fails',
			evidence: 'examples-cases',
			file: 'rejects-the-whole-catalog-when-a-source-read-fails.json'
		},
		[
			{
				name: 'a matching component file cannot be read',
				input: { failingPath: failing },
				error: DISK_ERROR
			}
		]
	);
});
