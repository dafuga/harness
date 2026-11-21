import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { scenarioManifestSchema, type ScenarioManifest } from '../src/core/unitTypes';
import type { VerificationScope } from './verification-targets';
import type { Command } from './unit-examples-verification-scopes.types';

const examplesFile = /^examples-.+\.json$/;
const rootCommand = /^bun test\/verification-output\.ts vitest (\S+)$/;
const packageCommand = /^bun \.\.\/\.\.\/test\/verification-output\.ts vitest (\S+)$/;
const packageCwd = /^packages\/([a-z0-9]+(?:[.-][a-z0-9]+)*)$/;

/** One scope per examples scenario under a repository root, each derived from its own file. */
export function unitExamplesScopes(root: string): Record<string, VerificationScope> {
	const directory = join(root, 'specification', 'scenarios');
	if (!existsSync(directory)) return {};
	const names = readdirSync(directory)
		.filter((name) => examplesFile.test(name))
		.sort();
	return Object.fromEntries(names.map((name) => examplesEntry(join(directory, name))));
}

/** The scenario's id keys its scope, so a file whose id is not its file name is refused. */
function examplesEntry(path: string): [string, VerificationScope] {
	const scenario = readScenario(path);
	if (scenario.id !== basename(path, '.json'))
		throw new Error(`${path}: id "${scenario.id}" must equal the file name without .json`);
	return [scenario.id, scopeOf(path, scenario)];
}

function readScenario(path: string): ScenarioManifest {
	const parsed = scenarioManifestSchema.safeParse(readDocument(path));
	if (!parsed.success) {
		const reasons = parsed.error.issues.map(
			(issue) => `${issue.path.join('.') || 'scenario'} ${issue.message}`
		);
		throw new Error(`${path}: ${reasons.join('; ')}`);
	}
	return parsed.data;
}

function readDocument(path: string): unknown {
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		throw new Error(`${path}: is not a readable JSON file`, { cause: error });
	}
}

/** A headless scenario with one command; each state is proved by the test of its own title. */
function scopeOf(path: string, scenario: ScenarioManifest): VerificationScope {
	if (scenario.kind !== 'headless') throw new Error(`${path}: kind must be headless`);
	if (scenario.tests.length !== 1) throw new Error(`${path}: must declare exactly one test`);
	const [command] = scenario.tests;
	if (command.runner !== 'command') throw new Error(`${path}: the test runner must be command`);
	const { package: name, file } = commandOf(path, command);
	const titles = scenario.states.map((state) => state.title);
	const repeated = titles.find((title, index) => titles.indexOf(title) !== index);
	if (repeated !== undefined)
		throw new Error(`${path}: state titles must be unique, but "${repeated}" repeats`);
	const proofs = Object.fromEntries(
		scenario.states.map((state) => [state.title, state.id] as const)
	);
	return { package: name, vitest: { [file]: proofs }, playwright: {} };
}

/** The package and test file of the command; its working directory must match its package. */
function commandOf(path: string, command: Command): { package: string; file: string } {
	const root = rootCommand.exec(command.target);
	if (command.cwd === '.' && root) return { package: 'root', file: root[1] };
	const name = packageCwd.exec(command.cwd ?? '')?.[1];
	const inPackage = packageCommand.exec(command.target);
	if (name && inPackage) return { package: name, file: inPackage[1] };
	throw new Error(
		`${path}: the test target must be "bun test/verification-output.ts vitest <file>" at cwd "." or "bun ../../test/verification-output.ts vitest <file>" at cwd "packages/<name>"`
	);
}

/** The examples scopes of this checkout, spread last into the registered verification scopes. */
export const unitExamplesVerificationScopes = unitExamplesScopes(
	resolve(import.meta.dirname, '..')
);
