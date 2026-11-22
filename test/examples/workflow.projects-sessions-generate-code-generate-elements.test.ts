import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { generateElements } from '../../src/workflows/projects-sessions/generate-code/generateElements';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const unitId = 'workflow.projects-sessions-generate-code-generate-elements';

function record(state: string, input: unknown, output: unknown) {
	recordExampleCases(
		{ unitId, symbol: 'generateElements', state, evidence: 'examples-cases', file: `${state}.json` },
		[{ name: state, input, output }]
	);
}

test('Installs canonical atoms in an app project', async () => {
	await withTempDir('generate-elements-app-', async (root) => {
		writeFileSync(join(root, 'package.json'), JSON.stringify({ harness: { kind: 'app' } }));
		const result = await generateElements({ root });
		expect(result.kind).toBe('elements');
		expect(result.name).toBe('HTML and SVG atoms');
		expect(result.exportsUpdated).toBe(false);
		record('installs-canonical-atoms-in-an-app-project', { root }, {
			kind: result.kind,
			name: result.name,
			writes: result.writes.map(({ path }) => path),
			exportsUpdated: result.exportsUpdated
		});
	});
});

test('Retains an existing shared native atom library', async () => {
	await withTempDir('generate-elements-shared-', async (root) => {
		writeFileSync(join(root, 'package.json'), JSON.stringify({ harness: { kind: 'game' } }));
		mkdirSync(join(root, 'src/components'), { recursive: true });
		mkdirSync(join(root, 'src/shared/atoms'), { recursive: true });
		writeFileSync(join(root, 'src/components/Feature.svelte'), '<!-- @harness-atoms ../shared/atoms -->');
		writeFileSync(join(root, 'src/shared/atoms/HtmlButton.svelte'), '<button></button>');
		const result = await generateElements({ root, force: true });
		expect(result.name).toBe('existing shared native atom library');
		expect(result.writes).toEqual([]);
		record('retains-an-existing-shared-native-atom-library', { root, force: true }, {
			kind: result.kind,
			name: result.name,
			writes: result.writes,
			exportsUpdated: result.exportsUpdated
		});
	});
});

test('Rejects a non-app project', async () => {
	await withTempDir('generate-elements-library-', async (root) => {
		writeFileSync(join(root, 'package.json'), JSON.stringify({ harness: { kind: 'lib' } }));
		let error: unknown;
		try {
			await generateElements({ root });
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain('Elements require a Harness app project.');
		record('rejects-a-non-app-project', { root }, {
			name: (error as Error).name,
			message: (error as Error).message
		});
	});
});
