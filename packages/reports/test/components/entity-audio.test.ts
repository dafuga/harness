import { expect, test } from 'vitest';
import { record, revision } from '../entityFixture';
import { content, count, words } from '../entityRender';
import { capture, commits, ids } from '../entityUnits';

const filter = { category: 'functions' as const, entity: ids.filter };
/** A record whose filter scenario also recorded a spoken confirmation for the matching state. */
function spoken(commit: string) {
	const taken = record(commit);
	taken.scenarios[1].states[0].captures.push(capture(commit, { kind: 'audio', state: 'match' }));
	return revision(commit, [taken]);
}

test('a clip recorded at the branch tip is heard on the overview, with its transcript', () => {
	const body = content('current', filter, { head: spoken(commits.tip) });
	expect(words(body)).toContain('Current audio');
	expect(body).toContain('/harness/media/ccccccc-match-audio.wav');
	expect(count(body, /<audio\b/g)).toBe(1);
	expect(words(body)).toContain('[Synthetic 440 Hz tone; no spoken words.]');
	expect(words(body)).not.toMatch(/Audio comparison|Before · /);
});

test('at a selected commit the clip of the parent stands beside the clip of the commit', () => {
	const body = content('commit', filter, {
		head: spoken(commits.middle),
		parent: spoken(commits.first)
	});
	expect(words(body)).toContain('Audio comparison');
	expect(body).toContain('aria-label="Before · aaaaaaa"');
	expect(body).toContain('aria-label="After · bbbbbbb"');
	expect(count(body, /<audio\b/g)).toBe(2);
	expect(body).toContain('/harness/media/aaaaaaa-match-audio.wav');
	expect(body).toContain('/harness/media/bbbbbbb-match-audio.wav');
});

test('a side that recorded no clip says so, and an entity without audio shows no audio panel', () => {
	const body = content('commit', filter, { head: spoken(commits.middle) });
	expect(count(body, /<audio\b/g)).toBe(1);
	expect(words(body)).toContain('No clip of this state is recorded for aaaaaaa.');
	const silent = content('commit', filter);
	expect(words(silent)).not.toMatch(/Audio comparison|Current audio/);
	expect(count(silent, /<audio\b/g)).toBe(0);
});
