import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import ProjectActivity from '../../src/components/project-activity/ProjectActivity.svelte';
import { activityPayload } from '../../tests/e2e/support/activityPayload';

const at = Date.parse('2026-10-11T12:00:00.000Z');
const large = activityPayload(at);
// The payload is plain data, as a page receives it; the component's own types are stricter.
const body = (props: object = {}) =>
	render(ProjectActivity, { props: { ...large, base: '/harness', ...props } as never }).body;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
/** The items of one named list: all of them, and those shown before anything is opened. */
function items(html: string, label: string) {
	const list = new RegExp(`<(ul|ol)[^>]*aria-label="${label}"[^>]*>(.*?)</\\1>`, 's').exec(html);
	const all = list?.[2].match(/<li\b[^>]*>/g) ?? [];
	return { all: all.length, shown: all.filter((tag) => !/\shidden\b/.test(tag)).length };
}

test('a busy repository is a short first view, with everything it holds one control away', () => {
	const html = body();
	expect(items(html, 'Recent commits')).toEqual({ all: 20, shown: 5 });
	expect(items(html, 'Uncommitted files')).toEqual({ all: 44, shown: 6 });
	expect(items(html, 'Committed files')).toEqual({ all: 40, shown: 6 });
	expect(items(html, 'Agent roster')).toEqual({ all: 12, shown: 5 });
	for (const control of [
		'Show all 20 commits',
		'Show all 44 uncommitted files',
		'Show all 40 committed files',
		'Show all 12 agents'
	]) {
		const button = new RegExp(`<button[^>]*aria-expanded="false"[^>]*>\\s*${control}\\s*</button>`);
		expect([control, button.test(html)]).toEqual([control, true]);
	}
	// What is not committed is found before what is.
	expect(html.indexOf('aria-label="Uncommitted files"')).toBeLessThan(
		html.indexOf('aria-label="Committed files"')
	);
	expect(text(html)).toContain('44 files are not committed in 2 of 2 checkouts');
});

test('a large change and a long assignment are a count and a few names until they are opened', () => {
	const html = body();
	const commits = html.split('aria-label="Recent commits"')[1];
	const first = commits.slice(0, commits.indexOf('</li>'));
	const closed = first.replace(/<details\b.*?<\/details>/gs, '');
	expect(text(closed)).toContain('549 components');
	expect(text(closed)).toContain('40 reasons');
	expect(closed).not.toContain('pa-chip');
	// Opened, it names the first twelve and says how many more its own page has.
	expect(first.match(/pa-chip/g)).toHaveLength(12);
	expect(text(first)).toContain('537 more components are on its page');
	expect(text(first)).toContain('37 more reasons are on its page');
	const roster = html.split('aria-label="Agent roster"')[1];
	const busy = roster.slice(0, roster.indexOf('</li>'));
	expect(busy.replace(/<details\b.*?<\/details>/gs, '').match(/pa-chip/g)).toHaveLength(4);
	expect(text(busy)).toContain('and 36 more');
	expect(busy.match(/pa-chip/g)).toHaveLength(40);
});

test('components and reasons say which registry and which notes they come from', () => {
	const live = text(body());
	expect(live).toContain('by the registry of this checkout as it is now');
	expect(live).toContain('Noted on this commit');
	const recorded = text(body({ activity: { ...large.activity, kind: 'recorded' }, live: null }));
	expect(recorded).toContain(`by the registry of commit ${large.activity.asOf.commit.slice(0, 7)}`);
	expect(recorded).toContain('Noted on this commit or accepted by its records');
	expect(recorded).not.toContain('as it is now');
});
