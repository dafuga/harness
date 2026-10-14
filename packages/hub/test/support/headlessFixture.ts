import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { author, fixture as planningFixture, git } from '../../../planning/test/planFixture';
import { projectionFixture } from './projectionFixture';

/**
 * A SYNTHETIC headless plan as the real planning package commits it: a registered function,
 * one notes-only version and its approval of those exact notes. The plan is written in a
 * temporary Git repository and the hub reads the files committed there, as checked out.
 */
type Json = Record<string, unknown>;
const manifest = new URL(
	'../../../../specification/units/desktop.function.time-label.json',
	import.meta.url
);
export const notes = 'Synthetic behaviour: a time label reads the minutes since an event.';
const contract = {
	responsibility: 'Synthetic headless notes',
	...{ inputs: [], outputs: [], errors: [], states: [], viewports: [] }
};
const generator = { provider: 'codex', model: 'synthetic' };

async function planned(unit: Json, text: string) {
	const made = await planningFixture();
	const path = `specification/units/${String(unit.id)}.json`;
	await mkdir(join(made.root, dirname(path)), { recursive: true });
	await writeFile(join(made.root, path), text);
	git(made.root, 'add', '.');
	git(made.root, 'commit', '-m', 'register the synthetic function');
	const plan = { unitId: unit.id, category: 'function', slug: 'time-label', title: 'Time label' };
	await made.api.createPlan({ ...plan, goal: 'Synthetic notes', author, contract } as never);
	return { ...made, path };
}

/** The function's notes-only v001, approved with its notes and contract, served to the hub. */
export async function headlessFixture() {
	const text = await readFile(manifest, 'utf8');
	const unit = JSON.parse(text) as Json & { owns: { source: string[] } };
	const { root, api, path } = await planned(unit, text);
	const unitId = String(unit.id);
	await api.addDesign({ unitId, prompt: 'Synthetic notes', generator, images: [], notes } as never);
	const before = (await api.readPlan({ unitId })) as unknown as Json & { versions: Json[] };
	await api.approveDesign({
		...{ unitId, version: 'v001', images: [], reviewer: 'Synthetic reviewer' },
		notesSha256: (before.versions[0].notes as { sha256: string }).sha256,
		contractHash: before.contractHash
	} as never);
	const stored = (await api.readPlan({ unitId })) as unknown as Json & { path: string };
	const f = projectionFixture();
	f.files.set(path, new TextEncoder().encode(text));
	for (const owned of unit.owns.source)
		f.files.set(
			owned,
			new TextEncoder().encode('// SYNTHETIC source of the registered function\n')
		);
	for (const file of git(root, 'ls-files', stored.path).split('\n').filter(Boolean))
		f.files.set(file, new Uint8Array(await readFile(join(root, file))));
	const approvals = [...f.files.keys()].filter((key) => key.includes('/approvals/'));
	const change = (file: string, edit: (value: Json) => Json) => {
		const value = JSON.parse(new TextDecoder().decode(f.files.get(file)!)) as Json;
		f.files.set(file, new TextEncoder().encode(JSON.stringify(edit(value))));
	};
	return { ...f, unitId, stored, approvals, change };
}
