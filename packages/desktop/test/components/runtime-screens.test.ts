import { expect, test } from 'vitest';
import { screenOptions } from '../../../reports/src/utils/entityScreens';
import RuntimeScreens from '../../src/components/RuntimeScreens.svelte';
import { commits, drawn, ids, scopeOf, shownEvidence } from '../evidence-fixture';

const shown = async (id: string, commit: string | null = null) => {
	const { store, result } = await shownEvidence(scopeOf(id, commit));
	const options = screenOptions(result.evidence.scenarios);
	return drawn(RuntimeScreens, { result, options, evidence: store });
};

test('a branch tip has one pane and no before or after', async () => {
	const body = await shown(ids.page);
	expect(body).toContain('Current screenshot');
	expect(body).toContain('aria-label="Current snapshot · ccccccc"');
	expect(body).toContain('Branch tip');
	expect(body.match(/<figure/g)).toHaveLength(1);
	expect(body).not.toMatch(/Before ·|After ·/);
});

test('a named commit stands beside its first parent, each side under its own name', async () => {
	const body = await shown(ids.page, commits.tip);
	expect(body).toContain('Before and after');
	expect(body).toContain('aria-label="Before · bbbbbbb"');
	expect(body).toContain('Parent commit');
	expect(body).toContain('aria-label="After · ccccccc"');
	expect(body).toContain('Selected commit');
	expect(body).toContain('1440 × 900');
	const older = await shown(ids.page, commits.middle);
	expect(older).toContain('aria-label="Before · aaaaaaa"');
	expect(older).toContain('No verification record is attached to this commit.');
});

test('sides that were not recorded alike are shown and not called a comparison', async () => {
	const body = await shown(ids.card, commits.tip);
	expect(body).toContain('Before and after, not alike');
	expect(body).toContain('Order card alone: viewport desktop is 1440×900 before and 1280×900');
	expect(body).toContain('>Order card alone</option>');
});
