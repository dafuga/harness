import { expect, test } from 'vitest';
import {
	artboardDocument,
	artboardPolicy
} from '../../../src/utils/planning-collaboration/artboardDocument';
import {
	artboardSize,
	parseArtboardSize
} from '../../../src/utils/planning-collaboration/artboardSize';
import { artboardViolations } from '../../../src/utils/planning-collaboration/artboardViolations';

const sized = (body: string) =>
	`<!doctype html><meta name="artboard-size" content="390x844">${body}`;

test('the policy is written before any byte of the artboard', () => {
	const shown = artboardDocument(
		sized('<head><img src="https://example.test/a.png"></head>'),
		'dark'
	);
	expect(shown.startsWith('<!doctype html><html data-theme="dark">')).toBe(true);
	expect(shown.indexOf(artboardPolicy)).toBeLessThan(shown.indexOf('artboard-size'));
	expect(artboardPolicy).toContain("default-src 'none'");
	expect(artboardPolicy).not.toMatch(/script|https?:|\*|'self'/);
	expect(shown.match(/<!doctype/gi)).toHaveLength(1);
});

test('connection hints and refreshes are removed, also when nested to survive one pass', () => {
	const hostile =
		'<link rel="dns-prefetch" href="//leak.test">' +
		'<li<link rel=x>nk rel="preconnect" href="//again.test">' +
		'<meta http-equiv="refresh" content="0;url=https://leak.test">';
	expect(artboardDocument(sized(hostile), 'light')).not.toMatch(/<link|refresh|leak\.test/);
});

test('an artboard declares a bounded fixed size', () => {
	expect(artboardSize(sized(''))).toEqual({ width: 390, height: 844 });
	expect(artboardSize('<p>no size</p>')).toBeNull();
	expect(artboardSize('<meta name="artboard-size" content="9999x10">')).toBeNull();
	expect(parseArtboardSize('desktop')).toEqual({ width: 1440, height: 900 });
	expect(parseArtboardSize('800x600')).toEqual({ width: 800, height: 600 });
	for (const bad of ['wide', 'toString', '50x600', '800x600px'])
		expect(parseArtboardSize(bad)).toBeNull();
});

test.each([
	['<script>1</script>', /script/],
	['<link rel="stylesheet" href="a.css">', /link/],
	['<iframe></iframe>', /frame/],
	['<meta http-equiv="refresh" content="1">', /refresh/],
	['<button onclick="x()">a</button>', /event handler/],
	['<img src="https://example.test/a.png">', /data:/],
	['<img\n  src="logo.png">', /data:/],
	['<style>a{background:url(https://example.test/a.png)}</style>', /styles load/],
	['<style>@import "theme.css";</style>', /styles load/]
])('refuses %s', (markup, reason) => {
	expect(artboardViolations(sized(markup)).join(' ')).toMatch(reason);
});

test('accepts static markup with inline styles, data URLs, fragments and written links', () => {
	const body =
		'<style>a{background:url(data:image/png;base64,AA==);fill:url(#g)}</style>' +
		'<img src="data:image/png;base64,AA=="><a href="https://example.test">on = off</a>';
	expect(artboardViolations(sized(body))).toEqual([]);
	expect(artboardViolations('<p>hi</p>')[0]).toContain('artboard-size');
});
