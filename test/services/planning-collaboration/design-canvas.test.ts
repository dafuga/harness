import { readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { createTempDirectory } from '../../support/temporary';
import { DesignCanvasService } from '../../../src/services/planning-collaboration/design-canvas-service/DesignCanvasService';
import { canvasArtifact } from '../../../src/services/planning-collaboration/design-canvas-service/canvasArtifact';
import { githubRepository } from '../../../src/services/planning-collaboration/design-canvas-service/committedCanvas';
import { trackerArtifactSchema } from '../../../src/utils/projects-sessions/trackerPlanning';
import { artboardViolations } from '../../../packages/reports/src/utils/planning-collaboration/artboardViolations';

let root: string;
let service: DesignCanvasService;
beforeEach(async () => {
	root = await createTempDirectory('design-');
	service = new DesignCanvasService(root);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const html = '<!doctype html><html><head><title>t</title></head><body>Hi</body></html>';
const file = (name: string) => readFileSync(join(root, 'designs/cards', name), 'utf8');

test('new, add and update write the committed files and keep order and positions', () => {
	service.create('cards', 'Cards');
	service.add('cards', 'Desktop', { title: 'Desktop cards' });
	service.add('cards', 'Mobile', { html, size: { width: 390, height: 844 }, order: 1 });
	expect(service.names()).toEqual(['cards']);
	expect(file('Desktop.html')).toContain('content="1440x900"');
	expect(file('Mobile.html')).toContain('<head>\n<meta name="artboard-size" content="390x844">');
	expect(service.manifest('cards').artboards.map((a) => a.file)).toEqual([
		'Mobile.html',
		'Desktop.html'
	]);
	service.update('cards', 'Desktop', { position: { x: 0, y: 900 }, title: 'Wide' });
	expect(service.read('cards').boards[1]).toMatchObject({ title: 'Wide', x: 0, y: 900 });
	service.update('cards', 'Desktop', { position: null });
	expect(JSON.parse(file('canvas.json')).artboards[1]).toEqual({
		file: 'Desktop.html',
		title: 'Wide'
	});
});

test('a refused change leaves the canvas as it was', () => {
	service.create('cards');
	service.add('cards', 'A', {});
	const before = [file('canvas.json'), file('A.html')];
	const script = '<meta name="artboard-size" content="390x844"><script></script>';
	expect(() => service.update('cards', 'A', { html: script })).toThrow(/script/);
	expect(() => service.update('cards', 'A', { html, order: 9 })).toThrow(/artboard-size/);
	expect(() => service.update('cards', 'A', { order: 9 })).toThrow(/--order/);
	expect(() => service.add('cards', 'a', {})).toThrow(/already/);
	expect(() => service.add('cards', '../x', {})).toThrow(/name/);
	expect(() => service.update('cards', 'Nope', {})).toThrow(/use add/);
	expect(() => service.create('cards')).toThrow(/exists/);
	expect(() => service.create('../cards')).toThrow(/canvas name/);
	expect([file('canvas.json'), file('A.html')]).toEqual(before);
});

test('a link to a file outside the canvas is never read', () => {
	service.create('cards');
	service.add('cards', 'A', {});
	writeFileSync(join(root, 'secret.html'), 'secret');
	rmSync(join(root, 'designs/cards/A.html'));
	symlinkSync(join(root, 'secret.html'), join(root, 'designs/cards/A.html'));
	expect(() => service.read('cards')).toThrow(/regular file/);
});

test('attaching keeps the stage text and replaces only this canvas', () => {
	service.create('cards', 'Cards');
	service.add('cards', 'A', {});
	const source = {
		repository: githubRepository('git@github.com:dafuga/harness.git'),
		commit: 'a'.repeat(40),
		branch: 'feat/x',
		viewer: 'https://hub.example.test/projects/p1/'
	};
	const kept = { name: 'Settings' };
	const once = canvasArtifact(service.read('cards'), source, { summary: 'S', pages: [kept] });
	const twice = canvasArtifact(service.read('cards'), source, once);
	expect(twice).toEqual(once);
	expect(trackerArtifactSchema.parse(twice).pages?.map((p) => p.name)).toEqual([
		'Settings',
		'Cards · A'
	]);
	expect(twice.links?.map((l) => l.url)).toEqual([
		'https://hub.example.test/projects/p1/designs/cards?branch=feat%2Fx',
		`https://github.com/dafuga/harness/tree/${source.commit}/designs/cards`
	]);
});

test('from a detached checkout the viewer link names the commit, as there is no branch', () => {
	service.create('cards', 'Cards');
	const source = {
		repository: 'https://github.com/dafuga/harness',
		commit: 'b'.repeat(40),
		branch: 'HEAD',
		viewer: 'https://hub.example.test/projects/p1'
	};
	expect(canvasArtifact(service.read('cards'), source).links?.[0].url).toBe(
		`https://hub.example.test/projects/p1/designs/cards?commit=${source.commit}`
	);
});

test('only a GitHub remote becomes a link, and never with its credentials', () => {
	expect(githubRepository('https://user:pw@github.com/a/b')).toBe('https://github.com/a/b');
	expect(() => githubRepository('https://example.test/a/b')).toThrow(/GitHub/);
});

test('every committed canvas is readable and each artboard is self-contained', () => {
	const committed = new DesignCanvasService(resolve(import.meta.dirname, '../../..'));
	expect(committed.names()).toContain('needs-you');
	for (const name of committed.names())
		for (const board of committed.read(name).boards)
			expect([board.file, board.problem, artboardViolations(board.html)]).toEqual([
				board.file,
				null,
				[]
			]);
});
