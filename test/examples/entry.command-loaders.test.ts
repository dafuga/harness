import type { LoaderName, LoaderCase } from './entry.command-loaders.test.types';
import { Command } from 'commander';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { commandLoaders } from '../../src/cli/commandLoaders';

const selectedLoaders: LoaderName[] = ['units', 'verify', 'history'];
const brokenLoaders: LoaderName[] = ['units', 'verify'];

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

async function rejectionOf(name: LoaderName, program: Command): Promise<unknown> {
	try {
		await commandLoaders[name](program);
	} catch (caught) {
		return caught;
	}
	return undefined;
}

async function brokenCase(name: LoaderName) {
	// A program without a command() method makes the family's register call throw.
	const error = await rejectionOf(name, {} as Command);
	expect(error).toBeInstanceOf(Error);
	const actual = error as Error;
	return {
		name: `${name} loader rejects when its registration throws`,
		input: name,
		error: { name: actual.name }
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

test('Throws Command family loading failure on a broken program', async () => {
	const cases = [];
	for (const name of brokenLoaders) {
		cases.push(await brokenCase(name));
	}

	recordExampleCases(
		{
			unitId: 'entry.command-loaders',
			symbol: 'commandLoaders',
			state: 'throws-command-family-loading-failure-on-a-broken-program',
			evidence: 'examples-cases',
			file: 'throws-command-family-loading-failure-on-a-broken-program.json'
		},
		cases
	);
});
