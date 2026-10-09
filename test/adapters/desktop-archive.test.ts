import { expect, test } from 'vitest';
import { DesktopArchiveAdapter } from '../../src/adapters/DesktopArchiveAdapter';
import { mkdtemp, mkdir, writeFile, symlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPackageWithOptions, statFile, extractFile } from '@electron/asar';

test('archive patch preserves native unpacked files and links and adds the bridge module', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-desktop-archive-'));
	const input = join(root, 'input');
	await mkdir(input);
	await writeFile(join(input, 'main.js'), 'original');
	await writeFile(join(input, 'native.node'), 'native fixture');
	await symlink('main.js', join(input, 'linked.js'));
	const source = join(root, 'original.asar');
	await createPackageWithOptions(input, source, { unpack: '*.node' });
	const target = join(root, 'patched.asar');
	await new DesktopArchiveAdapter().patch(
		source,
		target,
		new Map([
			['main.js', 'patched'],
			['bridge.js', 'bridge']
		])
	);
	expect(extractFile(target, 'main.js').toString()).toBe('patched');
	expect(extractFile(target, 'bridge.js').toString()).toBe('bridge');
	expect(statFile(target, 'linked.js', false)).toHaveProperty('link', 'main.js');
	expect(statFile(target, 'native.node')).toHaveProperty('unpacked', true);
	expect((await readFile(target + '.unpacked/native.node')).toString()).toBe('native fixture');
});
