import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ProjectRunRequest } from '../src/models/DesktopBridge.types';
import { fixture, git } from './run-fixture';

/**
 * A creation run asks with the registered ids of every catalog, those the request names first,
 * and says in public only what was checked: the notes of a valid proposal, or an answer in plain
 * words such as a question. Raw JSON is never said, and the strict proposal rules are unchanged.
 */
type Fixture = Awaited<ReturnType<typeof fixture>>;
const template = resolve(
	import.meta.dirname,
	'../../../specification/units/desktop.function.time-label.json'
);
async function registered(root: string) {
	const manifest = JSON.parse(await readFile(template, 'utf8'));
	await mkdir(join(root, 'specification/units'), { recursive: true });
	const consumers = ['app.component.refunds', 'app.service.refunds'];
	const owned = {
		...{ ...manifest, id: 'app.function.owned', title: 'owned', dependencies: [], scenarios: [] },
		owns: { source: ['src/owned.ts'], symbols: [] },
		helperContracts: [
			{
				name: 'owned',
				source: 'src/owned.ts',
				inputs: [],
				output: 'string',
				pure: true,
				consumers: consumers.map((unit) => ({ unit }))
			}
		],
		runtime: {
			kind: 'module',
			entry: 'src/owned.ts',
			targets: [{ kind: 'module', entry: 'src/owned.ts' }]
		}
	};
	await writeFile(join(root, 'specification/units/app.function.owned.json'), JSON.stringify(owned));
	await writeFile(join(root, 'src/owned.ts'), 'export const owned = () => "committed source";');
	for (const id of consumers) {
		const kind = id.split('.')[1],
			source = `src/${kind}.ts`;
		const unit = {
			...owned,
			id,
			kind,
			title: id,
			helperContracts: [],
			owns: { source: [source], symbols: [] },
			dependencies: [{ unit: owned.id, via: 'import', origin: 'declared' }],
			runtime: { kind: 'module', entry: source, targets: [{ kind: 'module', entry: source }] }
		};
		await writeFile(
			join(root, source),
			'import { owned } from "./owned"; export const text = owned();'
		);
		await writeFile(join(root, `specification/units/${id}.json`), JSON.stringify(unit));
	}
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'register the owned unit');
}
const notes = 'A list of refunds that formats each time with [[unit:app.function.owned]].';
const proposal = {
	...{ category: 'functions', title: 'Refund times', goal: 'Lists refund times.', proposal: notes },
	contract: { inputs: [], outputs: [{ name: 'list', type: 'string[]' }], errors: [] }
};
async function created(
	f: Fixture,
	answer: string,
	text = 'Add refunds beside [[unit:app.function.owned]]'
) {
	f.run.mockImplementation(async (turn) => ({ text: answer, model: turn.model }));
	const request: ProjectRunRequest = {
		...{ intent: 'create', projectId: f.session.projectId!, category: 'pages', mode: 'plan' },
		...{ provider: 'codex', model: 'selected', effort: 'high', text }
	};
	await f.service.start(request);
	await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
	return f.events.flatMap((event) => (event.kind === 'text' ? [event.text] : []));
}
const named = (prompt: string) => /^Units you may name: (.*)$/m.exec(prompt)?.[1] ?? '';

test('a pages request is asked with a registered function it names, and its checked notes are said', async () => {
	const f = await fixture();
	await registered(f.root);
	expect(await created(f, JSON.stringify(proposal))).toEqual([notes]);
	const prompt = f.run.mock.calls[0][0].prompt;
	expect(named(prompt).startsWith('[[unit:app.function.owned]]')).toBe(true);
	// The planned target of the fixture has no registry entry; no source is in the prompt.
	expect(named(prompt)).not.toContain(f.request.entityId);
	expect(prompt).not.toContain('committed source');
	expect(f.events.at(-1)).toMatchObject({ kind: 'finished' });
}, 20000);

test('an answer in plain words is said before the run is refused as no proposal', async () => {
	const f = await fixture();
	await registered(f.root);
	const question = 'Should the refunds page reuse [[unit:app.function.owned]] for its times?';
	expect(await created(f, question)).toEqual([question]);
	expect(f.events.at(-1)).toMatchObject({
		kind: 'failed',
		message: expect.stringContaining('proposal was not used')
	});
}, 20000);

test('a broken or fenced JSON answer is never said', async () => {
	const f = await fixture();
	expect(await created(f, '{"category": "functions", "title": "Refund')).toEqual([]);
	expect(await created(f, '```json\n{"category": 1}\n```')).toEqual([]);
	expect(f.events.filter((event) => event.kind === 'failed')).toHaveLength(2);
}, 20000);
