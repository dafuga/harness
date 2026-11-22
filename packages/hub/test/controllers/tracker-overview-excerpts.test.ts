import { expect, test } from 'vitest';
import { overviewFixture, overviewRequest, snapshot } from '../support/trackerOverviewFixture';

/** A synthetic recognized credential shape, never a real key. */
const SECRET = 'sk-SYNTHETICEXCERPTKEY0001';

/** The first ready card with its free text replaced; identity and totals stay as the fixture has them. */
function withText(title: string, note: string) {
	const base = snapshot();
	const card = base.projects[0];
	const item = { ...card.items[0], title };
	return { ...base, projects: [{ ...card, items: [item], attention: { item, text: note } }] };
}

async function storedOverview(fixture: ReturnType<typeof overviewFixture>, bearer: string) {
	const response = await fixture.handle(overviewRequest('GET', { bearer }));
	expect(response.status).toBe(200);
	return (await response.json()) as ReturnType<typeof snapshot>;
}

test('oversized live title and note are excerpted instead of discarding the snapshot', async () => {
	const f = overviewFixture();
	const bearer = await f.native();
	const put = await f.handle(
		overviewRequest('PUT', { bearer }, withText('T'.repeat(617), 'N'.repeat(1921)))
	);
	expect(put.status).toBe(204);
	const stored = await storedOverview(f, bearer);
	const card = stored.projects[0];
	expect(card.items[0].title).toBe('T'.repeat(499) + '…');
	expect(card.attention?.text).toBe('N'.repeat(999) + '…');
	expect(card.attention?.item).toEqual(card.items[0]);
	const original = snapshot();
	expect(card.agent).toBe(original.projects[0].agent);
	expect(card.state).toBe(original.projects[0].state);
	expect(card.counts).toEqual(original.projects[0].counts);
	expect(card.items[0].id).toBe(original.projects[0].items[0].id);
	expect(card.milestone).toEqual(original.projects[0].milestone);
	expect(stored.machines).toEqual(original.machines);
	expect(stored.liveSessions).toBe(original.liveSessions);
});

test('the other approved cards survive when one card carries oversized text', async () => {
	const f = overviewFixture();
	const bearer = await f.native();
	const base = withText('T'.repeat(617), 'N'.repeat(1921));
	const other = { ...snapshot().projects[0], agent: 'other-project' };
	const body = { ...base, projects: [base.projects[0], other], liveSessions: 2 };
	const put = await f.handle(overviewRequest('PUT', { bearer }, body));
	expect(put.status).toBe(204);
	const stored = await storedOverview(f, bearer);
	expect(stored.projects.map((p: { agent: string }) => p.agent)).toEqual([
		'synthetic-project',
		'other-project'
	]);
	expect(stored.projects[1]).toEqual(other);
});

test('a recognized secret that crosses the excerpt boundary is never retained', async () => {
	const f = overviewFixture();
	const bearer = await f.native();
	const title = 'a'.repeat(490) + ' ' + SECRET + ' ' + 'b'.repeat(100);
	const put = await f.handle(overviewRequest('PUT', { bearer }, withText(title, 'quiet')));
	expect(put.status).toBe(204);
	const stored = await storedOverview(f, bearer);
	const excerpt: string = stored.projects[0].items[0].title;
	expect(excerpt).not.toContain('SYNTHETICEXCERPT');
	expect(excerpt).not.toContain('sk-');
	expect(excerpt).not.toMatch(/\[redact(?!ed\])/);
	expect(excerpt).toBe('a'.repeat(490) + ' ' + '…');
});

test('an excerpt never splits a surrogate pair', async () => {
	const f = overviewFixture();
	const bearer = await f.native();
	const title = 'a'.repeat(498) + '😀' + 'b'.repeat(10);
	const put = await f.handle(overviewRequest('PUT', { bearer }, withText(title, 'quiet')));
	expect(put.status).toBe(204);
	const stored = await storedOverview(f, bearer);
	const excerpt: string = stored.projects[0].items[0].title;
	expect(excerpt).toBe('a'.repeat(498) + '…');
	expect(excerpt).not.toMatch(
		/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
	);
});

test('identifier lengths stay refused: an oversized agent name still fails the whole snapshot', async () => {
	const f = overviewFixture();
	const bearer = await f.native();
	const base = snapshot();
	const body = { ...base, projects: [{ ...base.projects[0], agent: 'a'.repeat(201) }] };
	const put = await f.handle(overviewRequest('PUT', { bearer }, body));
	expect(put.status).toBe(400);
	expect(await put.json()).toEqual({ error: 'invalid-input' });
	expect(f.bucket.objects.size).toBe(0);
});
