import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { ModuleCatalogService } from '../../../src/services/module-system/ModuleCatalogService';
import { ModuleInstallService } from '../../../src/services/module-system/ModuleInstallService';
import { ModuleResourceService } from '../../../src/services/module-system/ModuleResourceService';
import { measureWorkload } from '../../support/measureWorkload';

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function project() {
	const root = await mkdtemp(join(tmpdir(), 'harness-modules-'));
	roots.push(root);
	await writeFile(
		join(root, 'package.json'),
		JSON.stringify({ name: 'example', harness: { kind: 'app' } })
	);
	return root;
}

test('module library exposes Email and Offline with instructions and resource generators', async () => {
	await measureWorkload('service.module-system-module-catalog', 'read-module-library', async () => {
		const catalog = await new ModuleCatalogService().load(await project());
		expect(catalog.gaps).toEqual([]);
		expect(catalog.modules.map((item) => item.definition.id).sort()).toEqual(['email', 'offline']);
		for (const entry of catalog.modules) {
			expect(entry.installed).toBe(false);
			expect(entry.definition.instructions.length).toBeGreaterThan(0);
			expect(entry.definition.resources.length).toBeGreaterThan(0);
		}
	});
});

test('installing modules enables resource generation without replacing existing source', async () => {
	const root = await project();
	const install = new ModuleInstallService();
	const resources = new ModuleResourceService();
	await expect(resources.generate(root, 'email', 'email', 'Welcome')).rejects.toThrow(/install/i);
	await measureWorkload(
		'service.module-system-module-install',
		'install-email-offline',
		async () => {
			await install.add(root, 'email');
			await install.add(root, 'offline');
			await install.add(root, 'email');
		}
	);
	const catalog = await new ModuleCatalogService().load(root);
	expect(catalog.modules.every((item) => item.installed)).toBe(true);
	await measureWorkload('service.module-system-module-resource', 'generate-email-resource', () =>
		resources.generate(root, 'email', 'email', 'Welcome')
	);
	const path = join(root, 'src/mailers/email/WelcomeMailer.ts');
	expect(await readFile(path, 'utf8')).toContain('render(');
	await writeFile(path, 'user source');
	await expect(resources.generate(root, 'email', 'email', 'Welcome')).rejects.toThrow(
		/exist|overwrite/i
	);
	expect(await readFile(path, 'utf8')).toBe('user source');
	const manifest = JSON.parse(await readFile(join(root, 'harness.modules.json'), 'utf8'));
	expect(manifest.modules).toHaveLength(2);
	expect(manifest.resources).toHaveLength(1);
	const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
	expect(packageJson.dependencies['@dafuga01/offline-sync']).toMatch(/#[a-f0-9]{40}$/);
});

test('projects define a resource generator once and the catalog discovers it', async () => {
	const root = await project();
	await mkdir(join(root, 'specification/modules/notes'), { recursive: true });
	const definition = {
		schemaVersion: 1,
		id: 'notes',
		version: '1.0.0',
		title: 'Notes',
		description: 'Reusable note resources.',
		instructions: ['Keep each note focused.'],
		setup: [],
		dependencies: {},
		resources: [
			{
				id: 'note',
				title: 'Notes',
				singular: 'Note',
				kind: 'service',
				instructions: ['Implement the note.'],
				files: [
					{
						path: 'src/services/notes/{{PascalName}}Service.ts',
						contents: 'export class {{PascalName}}Service {}\n'
					}
				]
			}
		]
	};
	await writeFile(
		join(root, 'specification/modules/notes/module.json'),
		JSON.stringify(definition)
	);
	await new ModuleInstallService().add(root, 'notes');
	await new ModuleResourceService().generate(root, 'notes', 'note', 'Meeting');
	expect(await readFile(join(root, 'src/services/notes/MeetingService.ts'), 'utf8')).toContain(
		'MeetingService'
	);
	const catalog = await new ModuleCatalogService().load(root);
	expect(catalog.modules.find((item) => item.definition.id === 'notes')).toMatchObject({
		installed: true,
		source: 'project',
		instances: [{ name: 'Meeting', type: 'note' }]
	});
});

test('module admission rejects invalid definitions, collisions and escaping output paths', async () => {
	const root = await project();
	await mkdir(join(root, 'specification/modules/email'), { recursive: true });
	await writeFile(join(root, 'specification/modules/email/module.json'), '{"schemaVersion":1}');
	const catalog = await new ModuleCatalogService().load(root);
	expect(catalog.gaps.length).toBeGreaterThan(0);
	await expect(new ModuleInstallService().add(root, 'email')).rejects.toThrow(
		/definition|collision|module/i
	);
	await expect(
		new ModuleResourceService().generate(root, '../email', 'email', '../Escape')
	).rejects.toThrow();
	expect(await readFile(join(root, 'package.json'), 'utf8')).not.toContain('offline-sync');
});
