import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { unitProject } from './support/unitProject';
import { readUid } from '../src/utils/development-tooling/unitUid';

test('a generated component announces a uid that its unit keeps, and generating again changes nothing', async () => {
	const project = await unitProject('app');
	await project.harness(['generate', 'component', 'AppFrame']);
	const find = async () => {
		const names = await readdir(join(project.root, 'src/components'), { recursive: true });
		return names.filter((name) => name.endsWith('AppFrame.svelte'));
	};
	const [name] = await find();
	const path = join(project.root, 'src/components', name);
	const uid = readUid(await readFile(path, 'utf8'));
	expect(uid).toMatch(/^u_[a-z2-7]{10}$/);
	await project.harness(['generate', 'component', 'AppFrame']).catch(() => undefined);
	expect(readUid(await readFile(path, 'utf8'))).toBe(uid);
	await project.harness(['units', 'index', '--write']);
	const units = await readdir(join(project.root, 'specification/units'));
	const file = units.find((unit) => unit.includes('app-frame'))!;
	const manifest = JSON.parse(
		await readFile(join(project.root, 'specification/units', file), 'utf8')
	);
	expect(manifest.uid).toBe(uid);
});
