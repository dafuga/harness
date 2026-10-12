import { test, expect } from 'vitest';
import { fixture } from './project-fixture';
test('an explicit stale project ID cannot read the newly selected project', async () => {
	const a = await fixture(),
		b = await fixture();
	const first = await a.session.snapshot({ branch: null, commit: null });
	expect(first.project.id).toBeTypeOf('string');
	await a.session.open(b.root);
	await expect(
		a.session.snapshot({ projectId: first.project.id, branch: null, commit: null })
	).rejects.toThrow('project');
}, 15000);
