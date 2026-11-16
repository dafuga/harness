import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { consoleHostFiles } from '../../src/cli/program/console-install-service/consoleHostFiles';
import type { ConsoleHostOptions, HostFile } from '../../src/utils/development-tooling/consoleHostFiles.types';

const bundledOptions = {
	base: '/harness',
	policyModule: '$lib/server/harnessPolicy',
	policyExport: 'adminPolicy'
} satisfies ConsoleHostOptions;

const bucketOptions = {
	base: '/console',
	policyModule: '$lib/server/consolePolicy',
	policyExport: 'policy',
	bucket: { binding: 'CONSOLE_BUCKET', prefix: 'history' }
} satisfies ConsoleHostOptions;

function summarize(files: HostFile[]) {
	return files.map(({ path, contents }) => ({
		path,
		usesBucket: contents.includes('consoleStore'),
		usesBundle: contents.includes('consoleBundle'),
		usesPolicy: contents.includes('policy as policy') || contents.includes('adminPolicy as policy')
	}));
}

test('Generates bundled and private bucket console host routes', () => {
	const bundled = consoleHostFiles(bundledOptions);
	const bucket = consoleHostFiles(bucketOptions);
	expect(bundled).toHaveLength(5);
	expect(bucket[0]?.contents).toContain("'CONSOLE_BUCKET'");
	const cases = [
		{
			name: 'host uses bundled history at the harness route',
			input: bundledOptions,
			output: summarize(bundled)
		},
		{
			name: 'host reads history through its private bucket binding',
			input: bucketOptions,
			output: summarize(bucket)
		}
	];
	recordExampleCases(
		{
			unitId: 'function.console-host-files',
			symbol: 'consoleHostFiles',
			state: 'generates-bundled-and-private-bucket-console-host-routes',
			evidence: 'examples-cases',
			file: 'generates-bundled-and-private-bucket-console-host-routes.json'
		},
		cases
	);
});
