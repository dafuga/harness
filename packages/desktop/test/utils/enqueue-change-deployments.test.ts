import { expect, test, vi } from 'vitest';
import { deploymentFixture } from '../deployment-fixture';
import { deploymentState } from '../../src/utils/deploymentState';
test('background admission releases its caller and retains its project after navigation', async () => {
	const f = await deploymentFixture();
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	vi.mocked(f.plugin.deploy).mockImplementationOnce(async () => {
		await gate;
		return { deploymentId: 'background', url: 'https://example.invalid' };
	});
	const jobs = await f.service.enqueue({ environment: 'dev', commit: f.commit });
	try {
		expect(jobs).toHaveLength(1);
		expect(f.session.busy).toBe(false);
		expect(f.session.arbiter.held(f.root)).toBe(false);
		f.session.root = '/different/selection';
		f.session.projectId = 'another-project';
		expect(f.service.activities()[0]).toMatchObject({
			id: jobs[0].id,
			commit: f.commit,
			projectId: jobs[0].projectId
		});
		expect(JSON.stringify(f.service.activities())).not.toContain(f.root);
	} finally {
		release();
	}
	await f.activities.wait(jobs[0].id);
	expect((await deploymentState(f.root))[0].commit).toBe(f.commit);
});
