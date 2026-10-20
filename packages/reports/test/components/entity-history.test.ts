import { expect, test } from 'vitest';
import { writingCount, writingLimits } from '../../../../src/utils/writing-limits/writingLimits';
import { index, record, revision } from '../entityFixture';
import { content, disclosed, verdicts, words } from '../entityRender';
import { commits, ids } from '../entityUnits';

const filter = { category: 'functions' as const, entity: ids.filter, section: 'history' as const };
const hashes = (body: string) =>
	[...body.matchAll(/class="ex-hash"[^>]*>(\w+)</g)].map((match) => match[1]);

test('history lists the commits that changed the entity through the viewed commit, newest first', () => {
	const body = content('commit', filter);
	expect(hashes(body)).toEqual(['bbbbbbb', 'aaaaaaa']);
	expect(words(body)).toContain('Changes to this entity through bbbbbbb, newest first.');
	expect(words(body)).toContain('2026-10-09');
	expect(words(body)).toContain('Viewed commit');
	// The later tip is not part of the history of an earlier commit.
	expect(body).not.toContain('ccccccc');
});

test('a row has the behaviour change, the attempts, size, complexity and its evidence', () => {
	const body = content('commit', filter);
	expect(words(body)).toContain('Matches orders regardless of case.');
	expect(words(body)).toContain('Removed the second normalization. Normalizes once per request.');
	expect(words(body)).toContain('1.2 KB +200 B');
	expect(words(body)).toContain('Budget increase approved');
	expect(words(body)).toContain('source bytes 1000 → 1200');
	expect(words(body)).toContain('Fixture reviewer: Case folding needs the extra table.');
	expect(words(body)).toMatch(/2\s+−1/);
	// The evidence of a row is the icon alone, named for a reader of the screen.
	expect(verdicts(body).map((badge) => badge.name)).toContain('Full coverage passed');
	expect(words(body)).not.toContain('Full coverage passed');
});

test('timings stay by profile: one is chosen and no profile is compared with another', () => {
	const body = content('commit', filter);
	expect(body).toMatch(/<select[^>]*aria-label="Performance profile"/);
	expect(words(body)).toContain('Timing (bun-reference)');
	expect(words(body)).toContain('0.15 → 0.12 ms');
	expect(words(body)).toContain('p95 ms · bun-reference');
	expect(words(body)).toContain('p95 ms · ci-linux');
	// The other profile has no earlier value of its own, so it has none before.
	expect(words(body)).toMatch(/p95 ms · ci-linux Not measured 0\.31 ms —/);
});

test('view revision opens the entity at that commit, where it is compared with its own parent', () => {
	const body = content('current', filter);
	const base = '/harness/branch/feature%2Forders/commit';
	expect(body).toContain(`href="${base}/${commits.middle}/functions/${ids.filter}"`);
	expect(body).toContain(`href="${base}/${commits.first}/functions/${ids.filter}"`);
	expect(words(body)).toContain('Compare with previous');
	// The tip measured the same as the commit before it: it is not listed as a change.
	expect(hashes(body)).toEqual(['bbbbbbb', 'aaaaaaa']);
});

test('pages have a history too: the commit that added the page is listed as that', () => {
	const page = { category: 'pages' as const, entity: ids.page, section: 'history' as const };
	const body = content('commit', page);
	expect(hashes(body)).toEqual(['aaaaaaa']);
	// No reason was recorded for the page, so the row is told by the subject of its commit.
	expect(words(body)).toContain('aaaaaaa Added feat: orders page');
	expect(words(body)).toContain('This commit recorded no reason for this entity.');
	expect(words(body)).not.toContain('do not record what they changed');
});

test('commits of a history that does not record what they changed are said to be unknown', () => {
	const page = { category: 'pages' as const, entity: ids.page, section: 'history' as const };
	const old = { ...index, revisions: index.revisions.map(({ changes: _gone, ...kept }) => kept) };
	// At the tip only the tip was read; what the two before it did is not known, and not assumed.
	const body = content('current', page, {}, old);
	expect(hashes(body)).toEqual([]);
	expect(words(body)).toContain('No commit read so far is recorded as a change of this entity.');
	expect(words(body)).toContain('2 earlier commits do not record what they changed');
	expect(words(body)).toContain(
		'This history was built before it recorded what each commit changed.'
	);
	expect(words(body)).toContain('Read the next commits');
});

const inventory = Array.from({ length: 70 }, (_, order) => `unit${order}`).join(', ');
const tried = 'Registration only; implementation unchanged.';
const legacy = ['cpuSample', 'cpuClient', 'cpuGroups', 'cpuHistory'].map((symbol) => ({
	unit: ids.filter,
	symbol,
	file: 'src/utils/cpuClient.ts',
	change: 'modified',
	behavior: `Register ${symbol} of the analytics CPU client beside ${inventory}.`,
	simplification: { attempt: tried, outcome: 'not-applicable' },
	performance: {
		attempt: symbol === 'cpuHistory' ? `Sampled once a second instead of ${inventory}.` : tried,
		outcome: symbol === 'cpuHistory' ? 'improved' : 'not-applicable'
	}
}));
/** The sentences of the rows of a history, without the control that opens them in full. */
const said = (body: string) =>
	[...body.matchAll(/<td class="ex-said[^"]*">(.*?)<\/td>/gs)].map((found) =>
		words(found[1].replace(/<button\b.*?<\/button>/gs, '')).trim()
	);
const within = (text: string, limit: { words: number | null; characters: number }) => {
	const { words: total, characters } = writingCount(text);
	return (limit.words === null || total <= limit.words) && characters <= limit.characters;
};

test('long reasons of several functions stay a short row, with every original one press away', () => {
	const head = { ...revision(commits.middle, [record(commits.middle)]), explanations: legacy };
	const written = JSON.stringify(head.explanations);
	const body = content('commit', filter, { head });
	const [behavior, attempts] = said(body);
	// One row is as long as one reason may be, however many functions wrote one.
	expect(behavior.endsWith('…')).toBe(true);
	expect(within(behavior, writingLimits.behavior)).toBe(true);
	expect(writingCount(attempts).words).toBeLessThanOrEqual(2 * writingLimits.attempt.words);
	// The attempt all four share is said once.
	expect(attempts.split(tried).length - 1).toBe(1);
	expect(words(body)).not.toContain('unit69');
	expect(body).toContain('aria-label="Full reasons of bbbbbbb"');
	expect(body).toMatch(/<details class="ex-full" id="ex-reasons-full">/);
	// Opened, the disclosure holds each note as it was written and each outcome a function had.
	for (const reason of legacy) expect(disclosed(body)).toContain(reason.behavior);
	expect(disclosed(body)).toContain(`Sampled once a second instead of ${inventory}.`);
	expect(disclosed(body)).toContain(
		'simplification, not applicable · cpu sample, cpu client, cpu groups, cpu history'
	);
	expect(disclosed(body)).toContain('performance, improved · cpu history');
	expect(disclosed(body)).toContain('Full reasons 4 notes, 2 attempts');
	// Nothing was rewritten, and no file of the source is on the page.
	expect(JSON.stringify(head.explanations)).toBe(written);
	expect(body).not.toContain('src/utils');
});

test('one reason within the limits is read whole, with nothing to open', () => {
	const body = content('commit', filter);
	expect(said(body).slice(0, 2)).toEqual([
		'Matches orders regardless of case.',
		'Removed the second normalization. Normalizes once per request.'
	]);
	expect(body).not.toContain('Full reasons');
	expect(body).not.toContain('<details class="ex-full"');
});

test('a long note of a budget review is cut to the shared limit, with the whole note to open', () => {
	const note = `Independent review: ${Array.from({ length: 90 }, (_, order) => `finding${order}`).join(' ')}.`;
	const reviewed = {
		...index,
		units: index.units.map((unit) => ({
			...unit,
			reviews: (unit.reviews ?? []).map((review) => ({ ...review, reason: note }))
		}))
	};
	const body = content('commit', filter, {}, reviewed);
	const shown = /<p class="ex-approval">(.*?)<\/p>/s.exec(body)?.[1] ?? '';
	const said = words(shown)
		.replace(/^.*Fixture reviewer:/, '')
		.trim();
	expect(said.endsWith('…')).toBe(true);
	expect(within(said, writingLimits.body)).toBe(true);
	expect(words(body)).not.toContain('finding89');
	// The note as the reviewer wrote it is one press away, and nothing of it is lost.
	expect(disclosed(body)).toContain(note);
	expect(body).toContain('Full review note');
	// A note within the limit is read whole and has nothing to open.
	expect(content('commit', filter)).not.toContain('Full review note');
});
