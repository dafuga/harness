import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	DesktopExperimentService,
	replaceOnce
} from '../../scripts/prepare-desktop-experiment/DesktopExperimentService';
import { DesktopPatchAnchorError } from '../../scripts/prepare-desktop-experiment/DesktopExperimentService.types';

test('Replaces one exact desktop patch anchor', () => {
	const input = {
		source: 'p.app.setName(r.Rt(Q9))',
		anchor: 'p.app.setName(r.Rt(Q9))',
		replacement: 'p.app.setName("Codex Harness Experimental")'
	};
	const output = replaceOnce(input.source, input.anchor, input.replacement);
	expect(output).toBe(input.replacement);
	recordExampleCases(
		{
			unitId: 'service.desktop-experiment',
			symbol: 'replaceOnce',
			state: 'replaces-one-exact-desktop-patch-anchor',
			evidence: 'examples-cases',
			file: 'replaces-one-exact-desktop-patch-anchor.json'
		},
		[{ name: 'app name anchor is replaced', input, output }]
	);
});

test('Rejects a missing desktop patch anchor', () => {
	const input = {
		source: 'p.app.setName("Codex")',
		anchor: 'missing-anchor',
		replacement: 'updated'
	};
	let error: unknown;
	try {
		replaceOnce(input.source, input.anchor, input.replacement);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(DesktopPatchAnchorError);
	recordExampleCases(
		{
			unitId: 'service.desktop-experiment',
			symbol: 'replaceOnce',
			state: 'rejects-a-missing-desktop-patch-anchor',
			evidence: 'examples-cases',
			file: 'rejects-a-missing-desktop-patch-anchor.json'
		},
		[
			{
				name: 'absent anchor throws the dedicated error',
				input,
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]
	);
});

test('Rejects an absent configured desktop asset', () => {
	const input = {
		sources: new Map<string, string>(),
		options: {
			dataPath: '/tmp/codex-harness/desktop-experiment/user-data',
			catalogPath: '/tmp/codex-harness/desktop-experiment/catalog.json'
		}
	};
	let error: unknown;
	try {
		new DesktopExperimentService().plan(input.sources, input.options);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	recordExampleCases(
		{
			unitId: 'service.desktop-experiment',
			symbol: 'DesktopExperimentService.plan',
			state: 'rejects-an-absent-configured-desktop-asset',
			evidence: 'examples-cases',
			file: 'rejects-an-absent-configured-desktop-asset.json'
		},
		[
			{
				name: 'empty source map fails configured asset validation',
				input: { sourcePaths: [], options: input.options },
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]
	);
});
