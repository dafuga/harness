import { expect, test } from 'vitest';
import RuntimeAudio from '../../src/components/RuntimeAudio.svelte';
import { commits, drawn, ids, scopeOf, shownEvidence } from '../evidence-fixture';

const shown = async (id: string, commit: string | null = null) => {
	const { store, result, calls } = await shownEvidence(scopeOf(id, commit));
	return { body: drawn(RuntimeAudio, { result, evidence: store }), calls };
};

test('a clip of the branch tip is one clip, with what it says, read by its binding', async () => {
	const { body, calls } = await shown(ids.search);
	expect(body).toContain('Current audio');
	expect(body).toContain('aria-label="Current · ccccccc"');
	expect(body).toContain('Order filed.');
	expect(body).not.toMatch(/Before ·|After ·/);
	const read = calls.filter((call) => call.op === 'artifact');
	expect(read).toMatchObject([{ side: 'after', evidenceId: 'audio', viewport: null }]);
});

test('at a commit a side that recorded no clip says so', async () => {
	const { body } = await shown(ids.search, commits.tip);
	expect(body).toContain('Audio before and after');
	expect(body).toContain('aria-label="Before · bbbbbbb"');
	expect(body).toContain('No clip of this state is recorded for bbbbbbb.');
	expect(body).toContain('aria-label="After · ccccccc"');
});

test('a declared clip that no side recorded is said to be absent; an undeclared one is not shown', async () => {
	const absent = await shown(ids.search, commits.middle);
	expect(absent.body).toContain(
		'A clip is declared for this entity, and none is recorded at bbbbbbb.'
	);
	expect((await shown(ids.page)).body.trim()).toBe('');
});
