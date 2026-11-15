import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const videoManifest = {
	schemaVersion: 1,
	viewports: [
		{ id: 'desktop', width: 920, height: 700 },
		{ id: 'mobile', width: 390, height: 844 }
	],
	clips: ['first', 'second'].map((id) => ({
		id,
		unit: `component.${id}`,
		state: 'moving',
		viewports: ['desktop', 'mobile'],
		inputs: [`src/${id}.ts`],
		script: { path: `test/${id}.ts`, export: 'record' },
		fixture: `test/${id}.json`,
		entry: 'ready',
		exit: 'done',
		states: ['ready', 'done'],
		edges: ['finish'],
		durationSeconds: 3
	})),
	graphs: [],
	playlists: [{ id: 'all', clips: ['first', 'second'] }]
};
export async function prepareVideoEvidence(root: string) {
	for (const directory of ['src', 'test', 'specification/units'])
		await mkdir(join(root, directory), { recursive: true });
	for (const id of ['first', 'second']) {
		for (const [path, text] of [
			[`src/${id}.ts`, id],
			[`test/${id}.ts`, 'export function record() {}'],
			[`test/${id}.json`, '{}']
		])
			await writeFile(join(root, path), text);
		await writeFile(
			join(root, `specification/units/component.${id}.json`),
			JSON.stringify({
				id: `component.${id}`,
				status: 'active',
				owns: { source: [`src/${id}.ts`] },
				dependencies: []
			})
		);
	}
}
