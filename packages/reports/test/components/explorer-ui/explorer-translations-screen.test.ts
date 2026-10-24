import { expect, test } from 'vitest';
import ExplorerTranslationsScreen from '../../../src/components/explorer-ui/ExplorerTranslationsScreen.svelte';
import { revision } from '../../entityFixture';
import { screen, words } from '../../entityRender';
import { commits, ids } from '../../entityUnits';

test('translations compare source text safely with scoped caller links', () => {
	const head = revision(commits.middle, []);
	head.translations = {
		locales: ['en', 'fr', 'de'],
		gaps: [],
		rows: [
			{
				scope: 'reports',
				key: 'hello',
				values: { en: 'Hello {name}', fr: 'Bonjour {name}', de: 'Hallo {name}' },
				sources: ['src/en.json'],
				usedBy: [ids.list]
			},
			{
				scope: 'reports',
				key: 'empty',
				values: { en: '', fr: '<script>alert(1)</script>' },
				sources: [],
				usedBy: []
			},
			{ scope: 'reports', key: 'missing', values: { en: 'Not yet' }, sources: [], usedBy: [] }
		]
	};
	const body = screen(
		ExplorerTranslationsScreen,
		'commit',
		{ category: 'pages', screen: 'translations' },
		{ head }
	);
	expect(body).toContain('aria-label="Language"');
	expect(body).toContain('value="de"');
	expect(words(body)).toContain('English French Used In');
	expect(body).not.toContain('<code>hello</code>');
	expect(body).not.toContain('<small>reports</small>');
	expect(words(body)).not.toContain('Hallo {name}');
	expect(words(body)).toContain('Hello {name} Bonjour {name}');
	expect(words(body)).toContain('Empty string');
	expect(words(body)).toContain('Not translated');
	expect(body).not.toContain('<script>alert(1)</script>');
	expect(body).toContain('/components/' + ids.list);
	expect(body).toContain('/commit/' + commits.middle);
});

test('old revisions without catalog data do not display current dictionaries', () => {
	const body = screen(ExplorerTranslationsScreen, 'commit', {
		category: 'pages',
		screen: 'translations'
	});
	expect(words(body)).toContain('No translation catalog is recorded at this revision.');
});
