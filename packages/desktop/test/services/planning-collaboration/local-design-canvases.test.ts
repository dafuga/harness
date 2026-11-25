import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { localDesignCanvases } from '../../../src/lib/development-tooling/desktop-bridge/localDesignCanvases';
import { DesignCanvasService } from '../../../../../src/services/planning-collaboration/design-canvas-service/DesignCanvasService';
import { IpcRequestValidator } from '../../../src/validators/development-tooling/IpcRequestValidator';
import {
	localMethods,
	readMethods
} from '../../../../remote/src/models/networking-security/RemoteValues';

const made: string[] = [];
afterEach(() => made.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })));
function checkout() {
	const root = mkdtempSync(join(tmpdir(), 'mac-designs-'));
	made.push(root);
	const git = (...args: string[]) =>
		execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', ...args], {
			cwd: root
		});
	git('init', '-q', '-b', 'feat/cards');
	git('commit', '-q', '--allow-empty', '-m', 'start');
	return root;
}

test('reads the checkout’s canvases, uncommitted edits included', async () => {
	const root = checkout();
	const empty = await localDesignCanvases(root, null);
	expect(empty).toMatchObject({ branch: 'feat/cards', canvases: [], canvas: null });
	const service = new DesignCanvasService(root);
	service.create('cards', 'Cards');
	service.add('cards', 'Phone', { size: { width: 390, height: 844 } });
	mkdirSync(join(root, 'designs/broken'));
	writeFileSync(join(root, 'designs/broken/canvas.json'), '{');
	const page = await localDesignCanvases(root, 'cards');
	expect(page.canvases.map((c) => c.title)).toEqual(['broken (unreadable canvas.json)', 'Cards']);
	expect(page.canvas?.boards[0]).toMatchObject({ file: 'Phone.html', width: 390 });
	await expect(localDesignCanvases(root, 'missing')).rejects.toThrow(/no canvas named/);
});

test('a designs folder that links outside the project is not read', async () => {
	const outside = checkout();
	new DesignCanvasService(outside).create('secret');
	const root = checkout();
	symlinkSync(join(outside, 'designs'), join(root, 'designs'));
	await expect(localDesignCanvases(root, null)).rejects.toThrow(/outside the project/);
});

test('only this computer may ask, and only for a canvas name', () => {
	expect(localMethods).toContain('designCanvases');
	expect(readMethods).not.toContain('designCanvases');
	const parse = (input: unknown) => new IpcRequestValidator().parse('design:canvases', input);
	expect(parse({ canvas: null, extra: 1 })).toEqual({ canvas: null });
	expect(parse({ projectId: 'p1', canvas: 'needs-you' })).toEqual({
		projectId: 'p1',
		canvas: 'needs-you'
	});
	for (const canvas of ['../x', 'A', '', 4]) expect(() => parse({ canvas })).toThrow();
});
