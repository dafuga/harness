import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { ModulePackageService } from '../../src/services/module-system/ModulePackageService';

const UNIT_ID = 'service.module-system-module-package';
const service = new ModulePackageService();

async function planWithManifest(manifest: unknown, name: string) {
	return withTempDir('module-package-plan-', async (directory) => {
		writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest));
		return service.plan(directory, name);
	});
}

async function failureWithManifest(manifest: unknown, name: string): Promise<Error> {
	const outcome = await planWithManifest(manifest, name).then(
		() => undefined,
		(caught: unknown) => caught
	);
	expect(outcome).toBeInstanceOf(Error);
	return outcome as Error;
}

test('Plans a pinned scoped dependency into the manifest', async () => {
	const manifest = { name: 'web' };
	const planned = await planWithManifest(manifest, '@acme/ui-kit@2.4.1');
	const expected =
		'{\n\t"name": "web",\n\t"dependencies": {\n\t\t"@acme/ui-kit": "2.4.1"\n\t}\n}\n';

	expect(planned.path).toBe('package.json');
	expect(planned.contents).toBe(expected);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'ModulePackageService.plan',
			state: 'plans-a-pinned-scoped-dependency-into-the-manifest',
			evidence: 'examples-cases',
			file: 'plans-a-pinned-scoped-dependency-into-the-manifest.json'
		},
		[
			{
				name: 'scoped package with exact version is added to dependencies',
				input: { manifest, name: '@acme/ui-kit@2.4.1' },
				output: { path: planned.path, contents: planned.contents }
			}
		]
	);
});

test('Rejects a version range instead of an exact version', async () => {
	const error = await failureWithManifest({ name: 'web' }, 'typescript@^5.6.0');

	expect(error.message).toBe('Use a registry package with an exact version: package@1.2.3.');
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'ModulePackageService.plan',
			state: 'rejects-a-version-range-instead-of-an-exact-version',
			evidence: 'examples-cases',
			file: 'rejects-a-version-range-instead-of-an-exact-version.json'
		},
		[
			{
				name: 'caret range is rejected by the exact-version pattern',
				input: { manifest: { name: 'web' }, name: 'typescript@^5.6.0' },
				error: { name: error.name, message: error.message }
			}
		]
	);
});

test('Rejects when the dependency already pins another version', async () => {
	const manifest = { name: 'web', dependencies: { typescript: '5.5.0' } };
	const error = await failureWithManifest(manifest, 'typescript@5.6.3');

	expect(error.message).toBe('Resolve the existing dependency before generation.');
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'ModulePackageService.plan',
			state: 'rejects-when-the-dependency-already-pins-another-version',
			evidence: 'examples-cases',
			file: 'rejects-when-the-dependency-already-pins-another-version.json'
		},
		[
			{
				name: 'existing dependency at a different version blocks generation',
				input: { manifest, name: 'typescript@5.6.3' },
				error: { name: error.name, message: error.message }
			}
		]
	);
});
