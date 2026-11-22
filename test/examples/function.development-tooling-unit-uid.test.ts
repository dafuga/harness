import { test } from 'vitest';
import { readUid, uidComment, withUid } from '../../src/utils/development-tooling/unitUid';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const unitId = 'function.development-tooling-unit-uid';
const uid = 'u_e6w2kdpv7l';

test('Reads a UID annotation from source text', () => {
	const annotated = `// @harness-uid ${uid}\nexport const enabled = true;\n`;
	const found = readUid(annotated);
	const absent = readUid('export const enabled = true;\n');
	expect([found, absent]).toEqual([uid, undefined]);
	recordExampleCases(
		{
			unitId,
			symbol: 'readUid',
			state: 'reads-a-uid-annotation-from-source-text',
			evidence: 'examples-cases',
			file: 'reads-a-uid-annotation-from-source-text.json'
		},
		[
			{ name: 'source begins with a UID annotation', input: annotated, output: found },
			{ name: 'source has no UID annotation', input: 'export const enabled = true;\n', output: absent }
		]
	);
});

test('Selects UID comment syntax from the source path', () => {
	const line = uidComment('src/utils/development-tooling/unitUid.ts', uid);
	const html = uidComment('src/components/Button.svelte', uid);
	const suppressed = uidComment('packages/game/src/atoms/HtmlButton.svelte', uid);
	expect([line, html, suppressed]).toEqual([
		`// @harness-uid ${uid}`,
		`<!-- @harness-uid ${uid} -->`,
		undefined
	]);
	recordExampleCases(
		{
			unitId,
			symbol: 'uidComment',
			state: 'selects-uid-comment-syntax-from-the-source-path',
			evidence: 'examples-cases',
			file: 'selects-uid-comment-syntax-from-the-source-path.json'
		},
		[
			{ name: 'TypeScript uses a line comment', input: { path: 'src/utils/development-tooling/unitUid.ts', uid }, output: line },
			{ name: 'Svelte uses an HTML comment', input: { path: 'src/components/Button.svelte', uid }, output: html },
			{ name: 'canonical native atom suppresses comments', input: { path: 'packages/game/src/atoms/HtmlButton.svelte', uid }, output: suppressed }
		]
	);
});

test('Adds a UID comment at the appropriate source position', () => {
	const plain = 'export const enabled = true;\n';
	const shebang = '#!/usr/bin/env node\nconsole.log("ready");\n';
	const svelte = '<!-- @harness-note keep -->\n<script>export const enabled = true;</script>\n';
	const scriptPath = 'scripts/fixture.js';
	const outputs = [
		withUid('src/utils/development-tooling/unitUid.ts', plain, uid),
		withUid(scriptPath, shebang, uid),
		withUid('src/components/Example.svelte', svelte, uid)
	];
	expect(outputs).toEqual([
		`// @harness-uid ${uid}\n${plain}`,
		`#!/usr/bin/env node\n// @harness-uid ${uid}\nconsole.log("ready");\n`,
		`<!-- @harness-note keep -->\n<!-- @harness-uid ${uid} -->\n<script>export const enabled = true;</script>\n`
	]);
	recordExampleCases(
		{
			unitId,
			symbol: 'withUid',
			state: 'adds-a-uid-comment-at-the-appropriate-source-position',
			evidence: 'examples-cases',
			file: 'adds-a-uid-comment-at-the-appropriate-source-position.json'
		},
		[
			{ name: 'plain TypeScript receives a leading comment', input: { path: 'src/utils/development-tooling/unitUid.ts', code: plain, uid }, output: outputs[0] },
			{ name: 'shebang stays before the UID comment', input: { path: scriptPath, code: shebang, uid }, output: outputs[1] },
			{ name: 'Svelte comment follows leading Harness comments', input: { path: 'src/components/Example.svelte', code: svelte, uid }, output: outputs[2] }
		]
	);
});
