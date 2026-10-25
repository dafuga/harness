import { expect } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { auditPath } from '../../src/audit/audit';
import { ModuleInstallService } from '../../src/services/module-system/ModuleInstallService';
/** Standard structure boundary: defaults, available declarations, installed shapes and unknown siblings. */
export async function assertModuleAuditAdmission(root: string): Promise<void> {
	for (const folder of ['types', 'styles', 'extensions', 'unrelated'])
		await mkdir(join(root, 'src', folder), { recursive: true });
	await writeFile(join(root, 'src/types/Invoice.ts'), 'export interface Invoice { id: string; }\n');
	await writeFile(join(root, 'src/styles/invoice.css'), '/* Application tokens. */\n');
	await writeFile(join(root, 'src/extensions/example.ts'), 'export const example = true;\n');
	await writeFile(join(root, 'src/unrelated/example.ts'), 'export const example = true;\n');
	await writeFile(
		join(root, 'package.json'),
		JSON.stringify({ name: 'fixture', harness: { kind: 'app' } })
	);
	const definition = {
		schemaVersion: 1,
		id: 'extensions',
		version: '1.0.0',
		title: 'Extensions',
		description: 'Fixture extension code.',
		instructions: ['Keep extensions focused.'],
		setup: [],
		dependencies: {},
		resources: [
			{
				id: 'extension',
				title: 'Extensions',
				singular: 'Extension',
				kind: 'extension',
				instructions: ['Review the extension.'],
				files: [
					{
						path: 'src/extensions/{{PascalName}}.ts',
						contents: 'export const {{camelName}} = true;\n'
					}
				]
			}
		]
	};
	await mkdir(join(root, 'specification/modules/extensions'), { recursive: true });
	await writeFile(
		join(root, 'specification/modules/extensions/module.json'),
		JSON.stringify(definition)
	);
	const sources = async () =>
		(await auditPath(root))
			.filter((finding) => finding.rule === 'harness-source-structure')
			.map((finding) => finding.path);
	const available = await sources();
	expect(available).not.toContain('src/types/Invoice.ts');
	expect(available).not.toContain('src/styles/invoice.css');
	expect(available).toContain('src/extensions/example.ts');
	await new ModuleInstallService().add(root, 'extensions');
	const installed = await sources();
	expect(installed).not.toContain('src/extensions/example.ts');
	expect(installed).toContain('src/unrelated/example.ts');
}
