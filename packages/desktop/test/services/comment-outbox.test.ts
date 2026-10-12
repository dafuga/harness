import { test, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CommentOutboxService } from '../../src/services/CommentOutboxService';
import { ProjectionCacheService } from '../../src/services/ProjectionCacheService';
import type { HumanCommentDraft } from '../../src/models/ProjectContext.types';
test('human comments persist as pending drafts, survive cache deletion and never claim a commit', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-outbox-'));
	const input: HumanCommentDraft = {
		projectId: 'one',
		requestId: '10000000-0000-4000-8000-000000000001',
		anchor: {
			branch: 'main',
			commit: 'a'.repeat(40),
			entityId: 'page.home',
			version: null,
			imageSha256: null,
			state: null,
			viewport: null,
			region: null
		},
		text: 'Human comment without agent'
	};
	try {
		const outbox = new CommentOutboxService(join(root, 'outbox.json'));
		const draft = await outbox.save(input);
		expect(draft.kind).toBe('pending');
		expect(draft).not.toHaveProperty('commit');
		expect(await outbox.save(input)).toEqual(draft);
		await expect(outbox.save({ ...input, text: 'conflicting retry' })).rejects.toThrow('request');
		await new ProjectionCacheService(join(root, 'cache')).clear();
		expect(await new CommentOutboxService(join(root, 'outbox.json')).list('one')).toEqual([draft]);
		expect(await outbox.list('two')).toEqual([]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
