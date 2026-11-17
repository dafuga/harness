import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	auditAdapters,
	adaptersForProfile,
	adapterForExtension,
	knownAuditExtensions,
	resolveAuditProfile
} from '../../src/audit/development-tooling/adapters/registry';

const DETECTION_FIXTURES: Array<{ name: string; files: Record<string, string>; expected: string }> = [
	{ name: 'harness kind app', files: { 'package.json': '{"harness":{"kind":"app"}}' }, expected: 'app' },
	{ name: 'harness kind dapp', files: { 'package.json': '{"harness":{"kind":"dapp"}}' }, expected: 'dapp' },
	{ name: 'harness kind lib', files: { 'package.json': '{"harness":{"kind":"lib"}}' }, expected: 'lib' },
	{ name: 'svelte config marker', files: { 'svelte.config.js': 'export default {};' }, expected: 'app' },
	{ name: 'contracts directory marker', files: { 'contracts/token.sol': '// example' }, expected: 'dapp' },
	{ name: 'no markers', files: { 'README.md': '# example' }, expected: 'lib' }
];

const PROFILES = ['app', 'lib', 'dapp'] as const;

function writeFixture(directory: string, files: Record<string, string>): void {
	for (const [path, content] of Object.entries(files)) {
		mkdirSync(dirname(join(directory, path)), { recursive: true });
		writeFileSync(join(directory, path), content);
	}
}

test('Selects adapters per profile and finds extension owners', () => {
	const scoped = PROFILES.map((profile) => {
		const adapters = adaptersForProfile(profile);
		const ids = adapters.map((adapter) => adapter.id);
		expect(ids).toEqual(
			auditAdapters.filter((adapter) => adapter.profiles.includes(profile)).map((adapter) => adapter.id)
		);
		return { name: `adapters for ${profile}`, input: profile, output: ids };
	});

	const lookups = [
		{ extension: '.ts', profile: 'lib' as const },
		{ extension: '.ts', profile: 'dapp' as const },
		{ extension: '.go', profile: 'app' as const }
	].map(({ extension, profile }) => {
		const adapter = adapterForExtension(extension, profile);
		expect(adapter).toBe(adaptersForProfile(profile).find((item) => item.extensions.includes(extension)));
		return {
			name: `${extension} for ${profile}`,
			input: { extension, profile },
			output: adapter?.id ?? null
		};
	});

	recordExampleCases(
		{
			unitId: 'audit.adapters-registry',
			symbol: 'adaptersForProfile',
			state: 'selects-adapters-per-profile-and-finds-extension-owners',
			evidence: 'examples-cases',
			file: 'selects-adapters-per-profile-and-finds-extension-owners.json'
		},
		[...scoped, ...lookups]
	);
});

test('Lists known extensions once with future ones last', () => {
	const extensions = knownAuditExtensions();
	expect(new Set(extensions).size).toBe(extensions.length);
	expect(extensions).toContain('.ts');
	expect(extensions).toContain('.go');
	expect(extensions[extensions.length - 1]).toBe('.vue');

	recordExampleCases(
		{
			unitId: 'audit.adapters-registry',
			symbol: 'knownAuditExtensions',
			state: 'lists-known-extensions-once-with-future-ones-last',
			evidence: 'examples-cases',
			file: 'lists-known-extensions-once-with-future-ones-last.json'
		},
		[{ name: 'all registered and future extensions', input: 'registry', output: extensions }]
	);
});

test('Resolves explicit and detected audit profiles', async () => {
	const explicit = resolveAuditProfile('/workspace/project', 'dapp');
	expect(explicit).toBe('dapp');

	const detected = await Promise.all(
		DETECTION_FIXTURES.map(async (fixture) => {
			const output = await withTempDir('audit-registry-', (directory) => {
				writeFixture(directory, fixture.files);
				return resolveAuditProfile(directory);
			});
			expect(output).toBe(fixture.expected);
			return { name: fixture.name, input: fixture.files, output };
		})
	);

	const cases: Array<{ name: string; input: unknown; output: unknown }> = [
		{ name: 'explicit dapp profile', input: { root: '/workspace/project', profile: 'dapp' }, output: explicit },
		...detected
	];

	recordExampleCases(
		{
			unitId: 'audit.adapters-registry',
			symbol: 'resolveAuditProfile',
			state: 'resolves-explicit-and-detected-audit-profiles',
			evidence: 'examples-cases',
			file: 'resolves-explicit-and-detected-audit-profiles.json'
		},
		cases
	);
});
