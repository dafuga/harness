import { expect, test } from 'vitest';
import { hasWebLink, linkSegments } from '../../../src/utils/strings/linkSegments';

test('keeps HTTP and HTTPS targets and preserves surrounding punctuation as text', () => {
	const first = 'https://example.invalid/wiki/Name_(version)?view=full#part';
	const second = 'HTTP://example.invalid:8080/path';
	const text = `Open (${first}), then "${second}".`;
	expect(linkSegments(text)).toEqual([
		{ text: 'Open (' },
		{ text: first, href: first },
		{ text: '), then "' },
		{ text: second, href: second },
		{ text: '".' }
	]);
	expect(hasWebLink(text)).toBe(true);
});

test('keeps malformed, attached and non-web protocols as plain text', () => {
	const text = 'http:// ftp://example.invalid javascript:https://example.invalid https:///';
	expect(linkSegments(text)).toEqual([{ text }]);
	expect(hasWebLink(text)).toBe(false);
});
