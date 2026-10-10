import { expect, test } from 'vitest';
import { consoleDocument } from '../../src/utils/consoleDocument';

const assets = {
	script: 'const tag = "</script><script>alert(1)</script>"; const note = "<!--<script>";',
	style: 'a::after { content: "</style>" }'
};

test('the document carries the viewer and where its endpoints are, and nothing else', () => {
	const html = consoleDocument(assets, { base: '/harness' });
	expect(html.startsWith('<!doctype html>')).toBe(true);
	expect(html).toContain('<div id="app"></div>');
	expect(html).toContain('window.harnessConsole={"exportable":false,"base":"/harness"};');
	expect(html).toContain('<meta name="robots" content="noindex">');
	expect(html).toContain('<title>Harness</title>');
});

test('inlined text cannot close its element or start another', () => {
	const html = consoleDocument(assets, {
		base: '/harness',
		title: '<img src=x onerror=1>',
		links: [{ label: '</script><script>alert(2)</script>', href: '/x' }]
	});
	// Only the two real script elements are ever closed, and no comment can swallow that.
	expect(html.match(/<\/script>/g)).toHaveLength(2);
	expect(html).not.toContain('<!--');
	expect(html).toContain('const tag = "<\\/script><script>alert(1)<\\/script>"');
	expect(html.match(/<\/style>/g)).toHaveLength(1);
	expect(html).toContain('<title>&lt;img src=x onerror=1&gt;</title>');
	expect(html).not.toContain('alert(2)</script>');
});
