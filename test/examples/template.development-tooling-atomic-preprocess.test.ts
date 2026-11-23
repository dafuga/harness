import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { atomicComponents } from '../../src/templates/development-tooling/atomicPreprocess';

function recordError(state: string, name: string, input: unknown, error: unknown) {
	expect(error).toBeInstanceOf(Error);
	expect((error as Error).message).toContain(name);
	recordExampleCases(
		{
			unitId: 'template.development-tooling-atomic-preprocess',
			symbol: 'atomicComponents',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name, input, error: { name: (error as Error).name, message: (error as Error).message } }]
	);
}

async function processError(content: string, filename: string, aliases?: Record<string, string>) {
	try {
		await atomicComponents({ aliases }).markup?.({ content, filename });
	} catch (error) {
		return error;
	}
	return undefined;
}

test('Throws for an unknown native atom', async () => {
	const filename = '/workspace/project/src/components/Card.svelte';
	const content = '<hx-not-a-native-atom />';
	const error = await processError(content, filename);
	recordError(
		'throws-for-an-unknown-native-atom',
		'Unknown native atom',
		{ filename, content },
		error
	);
});

test('Throws when the atoms directory is undeclared', async () => {
	const filename = '/workspace/project/src/components/Card.svelte';
	const content = '<hx-div />';
	const error = await processError(content, filename);
	recordError(
		'throws-when-the-atoms-directory-is-undeclared',
		'Declare @harness-atoms',
		{ filename, content },
		error
	);
});

test('Throws when a native atom import alias is unresolved', async () => {
	const filename = '/workspace/project/src/components/Card.svelte';
	const content = '<script>import Div from "$lib/atoms/HtmlDiv.svelte";</script><Div />';
	const error = await processError(content, filename);
	recordError(
		'throws-when-a-native-atom-import-alias-is-unresolved',
		'configure its alias',
		{ filename, content, aliases: {} },
		error
	);
});

test('Throws when atom source violates its element contract', async () => {
	await withTempDir('atomic-preprocess-contract-', async (directory) => {
		const component = join(directory, 'Card.svelte');
		const atom = join(directory, 'atoms', 'HtmlDiv.svelte');
		mkdirSync(join(directory, 'atoms'));
		writeFileSync(atom, '<div>not a conforming atom</div>');
		const content = '<!-- @harness-atoms ./atoms --><hx-div />';
		const error = await processError(content, component);
		recordError(
			'throws-when-atom-source-violates-its-element-contract',
			'does not match its element contract',
			{ filename: component, content, atomSource: '<div>not a conforming atom</div>' },
			error
		);
	});
});

test('Skips markup without atom syntax', () => {
	const filename = '/workspace/project/src/components/Card.svelte';
	const content = '<p>Plain component markup</p>';
	const result = atomicComponents().markup?.({ content, filename });
	expect(result).toBeUndefined();
	recordExampleCases(
		{
			unitId: 'template.development-tooling-atomic-preprocess',
			symbol: 'atomicComponents',
			state: 'skips-markup-without-atom-syntax',
			evidence: 'examples-cases',
			file: 'skips-markup-without-atom-syntax.json'
		},
		[
			{
				name: 'ordinary markup is left for the next preprocessor',
				input: { filename, content },
				output: null
			}
		]
	);
});
