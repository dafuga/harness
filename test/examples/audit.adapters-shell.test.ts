import type { ShellFile } from './audit.adapters-shell.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { shellAdapter } from '../../src/audit/development-tooling/adapters/shell';
import { harnessRuleLimits } from '../../src/rules/explorer-ui/catalog';

function shellFile(contents: string): ShellFile {
	const lines = contents.split('\n');
	return {
		absolutePath: '/project/scripts/deploy.sh',
		relativePath: 'scripts/deploy.sh',
		extension: '.sh',
		contents,
		lines,
		structuralLines: lines,
		limits: harnessRuleLimits,
		size: contents.length
	};
}

function ruleIds(contents: string): string[] {
	return shellAdapter.audit(shellFile(contents)).map((finding) => finding.rule);
}

const cleanScript = '#!/usr/bin/env bash\nset -euo pipefail\necho "$NAME"\n';
const headerlessScript = 'echo done\n';
const unsafeScript = '#!/bin/sh\nset -euo pipefail\nrm -rf $DIR\n';

test('Accepts a strict, quoted shell script', () => {
	const rules = ruleIds(cleanScript);
	expect(rules).toEqual([]);

	recordExampleCases(
		{
			unitId: 'audit.adapters-shell',
			symbol: 'audit',
			state: 'accepts-a-strict-quoted-shell-script',
			evidence: 'examples-cases',
			file: 'accepts-a-strict-quoted-shell-script.json'
		},
		[{ name: 'strict quoted script', input: cleanScript, output: rules }]
	);
});

test('Flags missing shebang and strict mode', () => {
	const rules = ruleIds(headerlessScript);
	expect(rules).toEqual(['shell-shebang', 'shell-strict-mode']);

	recordExampleCases(
		{
			unitId: 'audit.adapters-shell',
			symbol: 'audit',
			state: 'flags-missing-shebang-and-strict-mode',
			evidence: 'examples-cases',
			file: 'flags-missing-shebang-and-strict-mode.json'
		},
		[{ name: 'script without header', input: headerlessScript, output: rules }]
	);
});

test('Flags broad rm -rf and unquoted variables', () => {
	const rules = ruleIds(unsafeScript);
	expect(rules).toEqual(['shell-unsafe-rm', 'shell-unquoted-variable']);

	recordExampleCases(
		{
			unitId: 'audit.adapters-shell',
			symbol: 'audit',
			state: 'flags-broad-rm-rf-and-unquoted-variables',
			evidence: 'examples-cases',
			file: 'flags-broad-rm-rf-and-unquoted-variables.json'
		},
		[{ name: 'rm -rf on a variable', input: unsafeScript, output: rules }]
	);
});

test('Describes the shell adapter profiles', () => {
	const summary = {
		id: shellAdapter.id,
		label: shellAdapter.label,
		profiles: shellAdapter.profiles,
		extensions: shellAdapter.extensions,
		optionalTools: shellAdapter.optionalTools
	};
	expect(summary.id).toBe('shell');
	expect(summary.profiles).toEqual(['app', 'dapp', 'lib']);
	expect(summary.extensions).toEqual(['.sh']);

	recordExampleCases(
		{
			unitId: 'audit.adapters-shell',
			symbol: 'shellAdapter',
			state: 'describes-the-shell-adapter-profiles',
			evidence: 'examples-cases',
			file: 'describes-the-shell-adapter-profiles.json'
		},
		[{ name: 'adapter metadata', input: 'shellAdapter', output: summary }]
	);
});
