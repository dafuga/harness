import { Command } from 'commander';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { commandLoaders } from '../../src/cli/commandLoaders';

type LoaderName = keyof typeof commandLoaders;
type LoaderCase = { name: string; input: unknown; output: unknown };

const selectedLoaders: LoaderName[] = ['units', 'verify', 'history'];

async function registerFamily(name: LoaderName) {
	const program = new Command('harness');
	const before = program.commands.length;
	const resolved = await commandLoaders[name](program);
	return { resolved, added: program.commands.length - before };
}

async function loaderCase(name: LoaderName): Promise<LoaderCase> {
	const { resolved, added } = await registerFamily(name);
	expect(resolved).toBeUndefined();
	expect(added).toBeGreaterThan(0);
	return {
		name: `registers the ${name} family`,
		input: name,
		output: { resolvesWithoutValue: resolved === undefined, commandsAdded: added }
	};
}

test('Registers each selected command family', () =>
	withTempDir('command-loaders-', async (_directory) => {
		const cases: LoaderCase[] = [];
		for (const name of selectedLoaders) {
			cases.push(await loaderCase(name));
		}

		recordExampleCases(
			{
				unitId: 'entry.command-loaders',
				symbol: 'commandLoaders',
				state: 'registers-each-selected-command-family',
				evidence: 'examples-cases',
				file: 'registers-each-selected-command-family.json'
			},
			cases
		);
	}));
