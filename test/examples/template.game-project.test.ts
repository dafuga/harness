import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { gameFiles } from '../../src/templates/game-authoring/gameProject';

const app = () => [
	{ path: 'package.json', contents: '{"name":"maze-game","devDependencies":{}}' },
	{ path: '.prettierrc', contents: '{}' },
	{
		path: 'vite.config.ts',
		contents: "import { sveltekit } from '@sveltejs/kit/vite';\nexport default { plugins: [sveltekit()], };\n"
	}
];

test('Generates a 2D game project scaffold', () => {
	const files = gameFiles({ name: 'maze-game', kind: 'game', dimension: '2d' }, app());
	const manifest = JSON.parse(files.find((file) => file.path === 'package.json')!.contents);
	const document = JSON.parse(files.find((file) => file.path === 'game.json')!.contents);
	expect(manifest.harness).toEqual({ kind: 'game', dimension: '2d', aiRendering: false });
	expect(files.map((file) => file.path)).toContain('GAME.md');
	expect(document.views[0].dimension).toBe('2d');
	recordExampleCases(
		{
			unitId: 'template.game-project',
			symbol: 'gameFiles',
			state: 'generates-a-2d-game-project-scaffold',
			evidence: 'examples-cases',
			file: 'generates-a-2d-game-project-scaffold.json'
		},
		[
			{
				name: 'maze-game receives the 2D manifest, document, and authoring guide',
				input: {
					project: { name: 'maze-game', kind: 'game', dimension: '2d' },
					app: app().map(({ path }) => path)
				},
				output: {
					files: files.map((file) => file.path),
					manifest: manifest.harness,
					dependencies: manifest.dependencies,
					viteContainsResolve: files
						.find((file) => file.path === 'vite.config.ts')!
						.contents.includes('resolve: { extensions:'),
					formatting: JSON.parse(files.find((file) => file.path === '.prettierrc')!.contents),
					documentDimension: document.views[0].dimension,
					guideHeading: files.find((file) => file.path === 'GAME.md')!.contents.split('\n')[0]
				}
			}
		]
	);
});

test('Throws SyntaxError when package JSON is invalid', () => {
	const files = app();
	files[0].contents = '{invalid';
	let error: unknown;
	try {
		gameFiles({ name: 'maze-game', kind: 'game' }, files);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(SyntaxError);
	recordExampleCases(
		{
			unitId: 'template.game-project',
			symbol: 'gameFiles',
			state: 'throws-syntaxerror-when-package-json-is-invalid',
			evidence: 'examples-cases',
			file: 'throws-syntaxerror-when-package-json-is-invalid.json'
		},
		[
			{
				name: 'Invalid package JSON is rejected',
				input: { project: { name: 'maze-game', kind: 'game' }, packageContents: '{invalid' },
				error: { name: 'SyntaxError' }
			}
		]
	);
});

test('Throws TypeError when a required app file is missing', () => {
	const files = app().filter((file) => file.path !== '.prettierrc');
	let error: unknown;
	try {
		gameFiles({ name: 'maze-game', kind: 'game' }, files);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(TypeError);
	recordExampleCases(
		{
			unitId: 'template.game-project',
			symbol: 'gameFiles',
			state: 'throws-typeerror-when-a-required-app-file-is-missing',
			evidence: 'examples-cases',
			file: 'throws-typeerror-when-a-required-app-file-is-missing.json'
		},
		[
			{
				name: 'Missing formatting config is rejected',
				input: { project: { name: 'maze-game', kind: 'game' }, files: ['package.json', 'vite.config.ts'] },
				error: { name: 'TypeError' }
			}
		]
	);
});
