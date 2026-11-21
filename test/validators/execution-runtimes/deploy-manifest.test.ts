import { chmodSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import {
	DeployManifestValidator,
	manifestDigest
} from '../../../src/validators/execution-runtimes/DeployManifestValidator';
import { deployFixture } from '../../support/scripted-deploy/fixture';

test('requires a private trusted registry and hashes reviewed scripts', () => {
	const fixture = deployFixture();
	try {
		const file = join(fixture.root, 'registry.json');
		const validate = new DeployManifestValidator();
		expect(validate.read(file).projects.fixture.image).toBe(fixture.project.image);
		chmodSync(file, 0o644);
		expect(() => validate.read(file)).toThrow('owner-only');
		const before = manifestDigest(fixture.project);
		writeFileSync(join(fixture.root, fixture.project.scripts.deploy), '# changed');
		expect(manifestDigest(fixture.project)).not.toBe(before);
		symlinkSync(file, join(fixture.root, 'scripts/linked.sh'));
		expect(() =>
			manifestDigest({
				...fixture.project,
				scripts: { ...fixture.project.scripts, deploy: 'scripts/linked.sh' }
			})
		).toThrow('regular files');
		expect(readFileSync(file, 'utf8')).toContain('fixture');
	} finally {
		fixture.dispose();
	}
});
