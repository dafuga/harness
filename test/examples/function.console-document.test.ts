import { test } from 'vitest';
import { consoleDocument } from '../../src/utils/development-tooling/consoleDocument';
import type {
	ConsoleAssets,
	ConsoleDocumentOptions
} from '../../src/utils/development-tooling/consoleDocument.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const state = 'builds-a-private-console-document-with-safe-inline-assets';

test('Builds a private console document with safe inline assets', () => {
	const assets: ConsoleAssets = {
		style: 'body{margin:0} </STYLE><!---->',
		script: "console.log('ready'); </ScRiPt><!--marker"
	};
	const options: ConsoleDocumentOptions = {
		base: '/console',
		title: 'Build & release',
		links: [{ label: 'Runs', href: '/console/runs' }]
	};
	const document = consoleDocument(assets, options);
	const output = {
		title: document.match(/<title>(.*?)<\/title>/)?.[1],
		settings: document.match(/window\.harnessConsole=(.*?);<\/script>/)?.[1],
		style: document.match(/<style>(.*?)<\/style>/)?.[1],
		script: [...document.matchAll(/<script>(.*?)<\/script>/g)].at(-1)?.[1],
		privateShell:
			document.includes('name="robots" content="noindex"') &&
			document.includes('<div id="app"></div>')
	};
	expect(output).toEqual({
		title: 'Build &amp; release',
		settings:
			'{"base":"/console","title":"Build & release","links":[{"label":"Runs","href":"/console/runs"}]}',
		style: 'body{margin:0} <\\/style><\\!---->',
		script: "console.log('ready'); <\\/script><\\!--marker",
		privateShell: true
	});
	recordExampleCases(
		{
			unitId: 'function.console-document',
			symbol: 'consoleDocument',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'escaped title, host settings, protected shell, and inert inline closing sequences',
				input: { assets, options },
				output
			}
		]
	);
});
