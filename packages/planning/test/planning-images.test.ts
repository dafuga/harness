import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { PNG } from 'pngjs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { author, contract, git, fixture } from './planFixture';
async function imageThread(api: Awaited<ReturnType<typeof fixture>>['api']) {
	const draft = await api.openThread({
		unitId: 'page.home',
		version: null,
		file: null,
		imageSha256: null,
		region: null,
		author,
		message: { author, mode: 'plan', body: 'Design home' }
	});
	expect(draft.value.anchor).toBeNull();
	const bytes = PNG.sync.write(new PNG({ width: 2, height: 2 }));
	const design = await api.addDesign({
		unitId: 'page.home',
		prompt: 'Home',
		generator: { provider: 'codex', model: 'selected' },
		images: [{ state: 'default', viewport: 'desktop', bytes }]
	});
	const image = design.value.images[0];

	const thread = await api.openThread({
		unitId: 'page.home',
		version: 'v001',
		file: image.file,
		imageSha256: image.sha256,
		region: { x: 0, y: 0, width: 0.5, height: 0.5 },
		author,
		viewedRevision: design.commit,
		message: { author, mode: 'plan', body: 'Revise region' }
	});
	await api.appendMessage({
		unitId: 'page.home',
		threadId: thread.value.id,
		author,
		mode: 'plan',
		body: 'Follow up'
	});
	return { design, image, bytes, thread };
}
async function rejectsNullVisualChange(
	api: Awaited<ReturnType<typeof fixture>>['api'],
	data: Awaited<ReturnType<typeof imageThread>>
) {
	const { design, image, thread } = data;
	const approval = await api.approveDesign({
		unitId: 'page.home',
		version: 'v001',
		images: [{ file: image.file, sha256: image.sha256 }],
		contractHash: design.value.contractHash,
		reviewer: 'Reviewer'
	});
	await expect(
		api.appendMessage({
			unitId: 'page.home',
			threadId: thread.value.id,
			author,
			mode: 'change',
			body: 'Invalid null target',
			change: {
				status: 'requested',
				target: {
					approvalId: approval.value.id,
					version: 'v001',
					contractHash: design.value.contractHash,
					imageSha256: null
				}
			}
		})
	).rejects.toThrow('Change image');
}
test('LFS image threads retain original revision, verify bytes, and expose missing content', async () => {
	const { root, api } = await fixture();
	await api.createPlan({
		category: 'page',
		slug: 'home',
		title: 'Home',
		goal: 'Home',
		author,
		contract
	});
	const { design, image, bytes, thread } = await imageThread(api);
	expect(git(root, 'show', `${design.commit}:src/pages/home/designs/v001/${image.file}`)).toContain(
		'version https://git-lfs'
	);
	const current = await api.readPlan({ unitId: 'page.home' });
	expect(current.threads.find((t) => t.id === thread.value.id)?.messages).toHaveLength(2);
	expect(
		(await api.readPlan({ unitId: 'page.home', revision: thread.commit })).threads.find(
			(t) => t.id === thread.value.id
		)?.messages
	).toHaveLength(1);
	expect(
		(
			await api.readImage({
				unitId: 'page.home',
				version: 'v001',
				file: image.file,
				revision: design.commit
			})
		).bytes
	).toEqual(new Uint8Array(bytes));
	await rejectsNullVisualChange(api, { design, image, bytes, thread });
	await rm(
		join(root, '.git/lfs/objects', image.sha256.slice(0, 2), image.sha256.slice(2, 4), image.sha256)
	);
	expect((await api.readPlan({ unitId: 'page.home' })).versions[0].images[0].content).toBe(
		'missing'
	);
	await expect(
		api.readImage({ unitId: 'page.home', version: 'v001', file: image.file })
	).rejects.toThrow();
}, 20000);
