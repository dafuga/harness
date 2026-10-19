import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import HarnessVerdict from '../../src/components/harness/harness-verdict/HarnessVerdict.svelte';
import { harnessIcons } from '../../src/utils/harnessIcons';

const markup = (props: Record<string, unknown>) =>
	render(HarnessVerdict, { props: props as never }).body.replace(/<!--.*?-->/g, '');
const text = (html: string) =>
	html
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
const root = (html: string) => html.match(/<span\b[^>]*class="hx-verdict[^"]*"[^>]*>/)?.[0] ?? '';
/** The mark a reader sees and presses: its opening tag and what is inside it. */
const mark = (html: string) => /<button\b([^>]*)>(.*?)<\/button>/s.exec(html) ?? ['', '', ''];
/** The tooltip: its opening tag and what it says. */
const tip = (html: string) =>
	/<span\b([^>]*role="tooltip"[^>]*)>(.*?)<\/span>\s*<\/span>\s*$/s.exec(html) ?? ['', '', ''];
/** What is drawn while nothing is opened: everything outside the tooltip. */
const drawn = (html: string) => html.replace(/<span\b[^>]*role="tooltip".*$/s, '');
const reasons = ['no capture of state empty at mobile', 'record is for another commit'];

test('a verdict draws its icon and no words: the green check for a pass', () => {
	const body = markup({ passed: true });
	expect(root(body)).toMatch(/class="hx-verdict[^"]*\bpassed\b/);
	expect(root(body)).not.toMatch(/\bfailed\b/);
	expect(body).toContain(`d="${harnessIcons.passed}"`);
	expect(body).not.toContain(`d="${harnessIcons.failed}"`);
	expect(body.match(/<svg\b/g)).toHaveLength(1);
	// Nothing is read off the page until the mark is pointed at, focused or tapped.
	expect(text(drawn(body))).toBe('');
	expect(tip(body)[1]).toMatch(/\shidden\b/);
});

test('no caller brings the words back: a label, a frame and the bare look all draw the icon alone', () => {
	for (const props of [
		{ passed: true, label: 'Full coverage passed' },
		{ passed: false, label: 'Coverage incomplete', reasons },
		{ passed: true, label: 'Full coverage passed', framed: true },
		{ passed: false, label: 'Evidence missing', bare: true }
	]) {
		const body = markup(props);
		expect([props.label, text(drawn(body))]).toEqual([props.label, '']);
		expect(root(body)).not.toContain('title=');
	}
	expect(root(markup({ passed: false, framed: true }))).toMatch(/\bframed\b/);
	expect(root(markup({ passed: false }))).not.toMatch(/\bframed\b/);
});

test('everything that is not a pass is the red cross: failed, missing, stale and unknown alike', () => {
	for (const passed of [false, undefined, null, 'true', 1, 0.99, 'passed', {}]) {
		const body = markup({ passed, label: 'Evidence missing' });
		const shown = [root(body).includes('failed'), body.includes(`d="${harnessIcons.failed}"`)];
		expect([passed, ...shown]).toEqual([passed, true, true]);
		expect([passed, /\bpassed\b/.test(root(body))]).toEqual([passed, false]);
		expect(body).not.toContain(`d="${harnessIcons.passed}"`);
	}
	// There is no third state, no share and no amber.
	for (const passed of [true, false]) {
		const body = markup({ passed, reasons: ['2 of 3 states'] });
		expect(drawn(body)).not.toMatch(/%|percent|partial|warning|amber/i);
	}
});

test('the mark is a button named by the status, and described by the tooltip that holds the reasons', () => {
	const body = markup({ passed: false, label: 'Coverage incomplete', reasons });
	const [, attributes, inside] = mark(body);
	expect(attributes).toContain('type="button"');
	expect(attributes).toContain('aria-label="Coverage incomplete"');
	expect(attributes).toContain('aria-expanded="false"');
	// The icon inside it is decoration: the button carries the name.
	expect(inside).toMatch(/<svg\b[^>]*aria-hidden="true"/);
	const id = /aria-describedby="([^"]+)"/.exec(attributes)?.[1];
	expect(id).toBeTruthy();
	expect(tip(body)[1]).toContain(`id="${id}"`);
	// The tooltip says the status first, then each reason, one to a line of its own.
	expect(text(tip(body)[2])).toBe(`Coverage incomplete ${reasons.join(' ')}`);
	expect(tip(body)[2].match(/<span\b/g)).toHaveLength(reasons.length);
});

test('a verdict has words of its own, and a pass is given no reasons', () => {
	expect(mark(markup({ passed: true }))[1]).toContain('aria-label="Full coverage passed"');
	expect(mark(markup({ passed: false }))[1]).toContain('aria-label="Verification failed"');
	const passed = markup({ passed: true, label: 'Passed', reasons });
	expect(text(tip(passed)[2])).toBe('Passed');
	expect(text(tip(markup({ passed: false, label: 'Not stored' }))[2])).toBe('Not stored');
});

test('it is made of phrasing content only, so a paragraph, a cell or a heading may hold it', () => {
	expect(markup({ passed: false, label: 'Coverage incomplete', reasons })).not.toMatch(
		/<(div|p|ul|ol|li|section)\b/
	);
});
