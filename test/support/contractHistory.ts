import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { vi } from 'vitest';
import { expect } from 'vitest';
import { loadCliProgram } from '../../src/cli/loadCliProgram';
import { contractUnit, writeContract } from './contractsProject';
import { measureWorkload } from './measureWorkload';

export function historyGit(root: string, ...args: string[]): string {
	return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

export async function historyFixture(root: string) {
	historyGit(root, 'init', '-q');
	historyGit(root, 'config', 'user.name', 'Contract Fixture');
	historyGit(root, 'config', 'user.email', 'contract@example.invalid');
	const unit = {
		...contractUnit('service.price', 'src/services/billing/Price.ts'),
		uid: 'u_historyprice',
		futureField: { enabled: false },
		contract: {
			origin: 'declared',
			inputs: [],
			outputs: [
				{ name: 'total', type: 'number', description: 'Quoted amount.' },
				{ name: 'currency', type: 'string', description: 'Currency code.' }
			],
			errors: []
		}
	};
	await writeContract(root, 'price.json', unit);
	const initial = commitHistory(root, 'feat: initial contract');
	return { root, unit, initial };
}

export function commitHistory(root: string, subject: string): string {
	historyGit(root, 'add', '.');
	historyGit(root, 'commit', '-qm', subject);
	return historyGit(root, 'rev-parse', 'HEAD');
}

export async function runHistory(root: string, ...args: string[]): Promise<string> {
	const output: string[] = [];
	const program = (await loadCliProgram(['contracts', ...args])).exitOverride();
	const pending = [...program.commands];
	for (const command of pending) {
		command.exitOverride();
		pending.push(...command.commands);
	}
	program.configureOutput({ writeOut: (text) => output.push(text), writeErr: () => {} });
	const logged = vi.spyOn(console, 'log').mockImplementation((text) => output.push(String(text)));
	try {
		await measureWorkload('command.development-tooling-contracts', args[0], () =>
			program.parseAsync(['contracts', ...args, '--root', root], { from: 'user' })
		);
		return output.join('\n');
	} finally {
		logged.mockRestore();
	}
}

export async function reformatHistory(root: string): Promise<void> {
	const path = join(root, 'specification/units/price.json');
	await writeFile(path, `${JSON.stringify(JSON.parse(await readFile(path, 'utf8')), null, 4)}\n`);
}

export async function assertHistoryRefBoundaries(root: string): Promise<void> {
	const head = historyGit(root, 'rev-parse', 'HEAD');
	const parent = historyGit(root, 'rev-parse', 'HEAD^');
	const movable = 'a'.repeat(64);
	historyGit(root, 'branch', movable, parent);
	expect(
		JSON.parse(await runHistory(root, 'diff', `${movable}..HEAD`, '--json')).summary.contracts
	).toBe(1);
	historyGit(root, 'branch', '-f', movable, head);
	expect(JSON.parse(await runHistory(root, 'diff', `${movable}..HEAD`, '--json')).changes).toEqual(
		[]
	);
}

export async function assertOrderedHistoryExamples(
	root: string,
	unit: Awaited<ReturnType<typeof historyFixture>>['unit']
): Promise<void> {
	await writeContract(root, 'price.json', {
		...unit,
		examples: [[1, 2], { name: 'business', values: [1, 2] }]
	});
	commitHistory(root, 'feat: ordered examples');
	await writeContract(root, 'price.json', {
		...unit,
		examples: [[2, 1], { name: 'business', values: [2, 1] }]
	});
	const examples = JSON.parse(await runHistory(root, 'diff', '--field', 'examples', '--json'));
	expect(examples.summary.fields).toBe(4);
	expect(examples.changes[0].fields.map((field: { path: string }) => field.path)).toContain(
		'examples[1].values[0]'
	);
}
