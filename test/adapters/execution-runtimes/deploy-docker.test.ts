import { expect, test } from 'vitest';
import { DeployDockerAdapter } from '../../../src/adapters/execution-runtimes/DeployDockerAdapter';
import { deployFixture } from '../../support/scripted-deploy/fixture';

test('refuses ambiguous mounts before starting a container', async () => {
	const fixture = await deployFixture();
	try {
		const docker = new DeployDockerAdapter({ project: fixture.project });
		await expect(docker.run('build', { '/out': '/tmp/invalid,readonly' }, {})).rejects.toThrow(
			'Invalid Docker deployment mount'
		);
	} finally {
		fixture.dispose();
	}
});
