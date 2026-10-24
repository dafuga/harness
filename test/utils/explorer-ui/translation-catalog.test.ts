import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { IntlMessageFormat } from 'intl-messageformat';
import { translationCatalog } from '../../../src/services/explorer-ui/revision-detail-service/translationCatalog';
import {
	flattenMessages,
	translationMessages
} from '../../../src/services/explorer-ui/revision-detail-service/translationMessages';
import type { SourceTree } from '../../../src/core/sourceTypes';

const snapshot = (files: Record<string, string>): SourceTree => ({
	revision: 'fixture',
	list: async () =>
		Object.entries(files).map(([path, text]) => ({
			path,
			hash: createHash('sha256').update(text).digest('hex')
		})),
	read: async (path) => {
		if (!(path in files)) throw new Error('Not in this revision');
		return files[path];
	}
});
const register = (body: string) => `import { addMessages } from 'svelte-i18n'; ${body}`;

test('reads inline and imported language resources without executing registration code', async () => {
	const files = {
		'src/locale.ts': register(
			`import fr from './fr.json'; addMessages('en', {welcome:'Hello {name}', nested:{empty:''}}); addMessages('fr',fr); throw new Error('must never execute');`
		),
		'src/fr.json': JSON.stringify({ welcome: 'Bonjour {name}', nested: { empty: '' } }),
		'src/Page.svelte': `<script>import {t} from './locale';</script><h1>{$t('welcome',{values:{name:'Anna'}})}</h1>`
	};
	const result = await translationCatalog(snapshot(files), [
		{ id: 'page.home', owns: { source: ['src/Page.svelte'], symbols: [] } }
	] as never);
	expect(result.locales).toEqual(['en', 'fr']);
	expect(result.rows.find((row) => row.key === 'welcome')).toMatchObject({
		scope: '.',
		values: { en: 'Hello {name}', fr: 'Bonjour {name}' },
		usedBy: ['page.home']
	});
	expect(result.rows.find((row) => row.key === 'nested.empty')?.values).toEqual({ en: '', fr: '' });
	expect(result.gaps).toEqual([]);
});

test('keeps different packages separate and records missing translations without fallback', async () => {
	const result = await translationCatalog(
		snapshot({
			'packages/a/src/locale.ts': register(`addMessages('en',{save:'Save'});`),
			'packages/b/src/locale.ts': register(`addMessages('fr',{save:'Enregistrer'});`)
		})
	);
	expect(result.rows).toHaveLength(2);
	expect(result.rows[0].values).toEqual({ en: 'Save' });
	expect(result.rows[1].values).toEqual({ fr: 'Enregistrer' });
});

test('selected snapshots cannot retain values from another revision', async () => {
	const old = snapshot({ 'src/locale.ts': register(`addMessages('en',{save:'Save'});`) });
	const current = snapshot({
		'src/locale.ts': register(
			`addMessages('en',{save:'Store'}); addMessages('fr',{save:'Enregistrer'});`
		)
	});
	expect((await translationCatalog(old)).rows[0].values).toEqual({ en: 'Save' });
	expect((await translationCatalog(current)).rows[0].values).toEqual({
		en: 'Store',
		fr: 'Enregistrer'
	});
	expect((await translationCatalog(snapshot({}))).rows).toEqual([]);
});

test('computed dictionaries and conflicting strings are gaps, never invented values', async () => {
	const result = await translationCatalog(
		snapshot({
			'src/locale.ts': register(
				`addMessages('en',{save:'Save'}); addMessages('en',{save:'Different'}); addMessages(language, load());`
			)
		})
	);
	expect(result.rows[0].values.en).toBe('Save');
	expect(result.gaps).toHaveLength(2);
	expect(result.gaps.join(' ')).toContain('Conflicting');
	expect(result.gaps.join(' ')).toContain('Dynamic');
});

test('unrelated addMessages calls are not app translations', () => {
	expect(
		translationMessages(`function addMessages(){}; addMessages('fr',{fake:'Fake'});`).registrations
	).toEqual([]);
	expect(flattenMessages({ nested: { text: '<strong>é</strong>', empty: '' } })).toEqual({
		'nested.text': '<strong>é</strong>',
		'nested.empty': ''
	});
});

test.each(['reports', 'replay'])(
	'%s English and French have matching keys, valid ICU and matching parameters',
	(group) => {
		const read = (locale: string) =>
			flattenMessages(
				JSON.parse(
					readFileSync(
						`packages/reports/src/${group === 'reports' ? 'utils/reports-media/report-locale' : 'components/reports-media/gameplay-replay/translations'}/${locale}.json`,
						'utf8'
					)
				)
			);
		const english = read('en'),
			french = read('fr');
		expect(Object.keys(french)).toEqual(Object.keys(english));
		for (const [key, message] of Object.entries(english)) {
			const names = (value: string) =>
				[...value.matchAll(/\{(\w+)(?:\}|,)/g)].map((m) => m[1]).sort();
			expect(names(french[key]), key).toEqual(names(message));
			expect(() => new IntlMessageFormat(message, 'en'), key).not.toThrow();
			expect(() => new IntlMessageFormat(french[key], 'fr'), key).not.toThrow();
		}
	}
);
