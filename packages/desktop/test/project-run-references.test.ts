import type { Fixture } from './project-run-references.test.types';
import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { ProjectRunRequest } from '../src/models/DesktopBridge.types';
import { fixture, git } from './run-fixture';
const template = resolve(
	import.meta.dirname,
	'../../../specification/units/desktop.function.time-label.json'
);
function referenceUnit(base: Record<string, unknown>, kind: 'function' | 'component' | 'service') {
	const entry = `src/${kind}.ts`;
	return {
		...base,
		id: kind === 'function' ? 'app.function.owned' : `app.${kind}.consumer`,
		kind,
		title: kind === 'function' ? 'owned' : kind,
		owns: { source: [entry], symbols: [kind === 'function' ? 'owned' : 'consumer'] },
		runtime: { kind: 'module', entry, targets: [{ kind: 'module', entry }] },
		scenarios: [],
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
		dependencies:
			kind === 'function' ? [] : [{ unit: 'app.function.owned', via: 'import', origin: 'declared' }]
	};
}
async function registered(root: string) {
	const manifest = JSON.parse(await readFile(template, 'utf8'));
	await mkdir(join(root, 'specification/units'), { recursive: true });
	const owned = {
		...referenceUnit(manifest, 'function'),
		helperContracts: [
			{
				name: 'owned',
				source: 'src/function.ts',
				inputs: [],
				output: 'number',
				pure: true,
				examples: [{ name: 'Stable result', call: 'owned()', input: null, output: 0 }],
				consumers: [{ unit: 'app.component.consumer' }, { unit: 'app.service.consumer' }]
			}
		]
	};
	await writeFile(
		join(root, 'src/function.ts'),
		'/** @pure */\nexport function owned(): number { return 0; }\n'
	);
	for (const kind of ['component', 'service'] as const) {
		const consumer = referenceUnit(manifest, kind);
		await writeFile(
			join(root, `specification/units/${consumer.id}.json`),
			JSON.stringify(consumer)
		);
		await writeFile(
			join(root, `src/${kind}.ts`),
			"import { owned } from './function';\nexport const consumer = owned();\n"
		);
	}
	await writeFile(join(root, 'specification/units/app.function.owned.json'), JSON.stringify(owned));
	execFileSync(
		'bun',
		[
			'-e',
			"import { owned } from './src/function.ts'; if (owned() !== 0) throw Error('Fixture example failed');"
		],
		{ cwd: root }
	);
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
