import type { LedgerEvent, EmittedFinding } from './emittedRepo.types';
import { baselineRepo, type VerifyRepo } from './verifyRepo';

export const ledger = 'specification/budgets/ledger.ndjson';

/**
 * The fixture build. Every size comes from one comment in the source of the unit, digit for
 * digit, so what a unit emits can grow or go missing while its source keeps the size it had:
 * `p` is the process output of slugify, `w` its Wasm output, `c` the Wasm output of the clock.
 * A zero builds nothing for that target.
 */
const digit = (letter: string, file: string) =>
	`$(sed -n 's/.*build:.* ${letter}\\([0-9]\\).*/\\1/p' src/utils/${file}.ts)`;
const emit = (letter: string, file: string, path: string) =>
	`n=${digit(letter, file)}; if [ "$n" != 0 ]; then head -c "$n" /dev/zero > ${path}; fi`;
/** The setup command that builds each output: its letter, the unit file with the digit, its path. */
export const emittedSetup = (outputs: Array<[string, string, string]>): string =>
	['mkdir -p artifacts', ...outputs.map(([letter, file, path]) => emit(letter, file, path))].join(
		'; '
	);
const setup = emittedSetup([
	['p', 'slugify', 'artifacts/slugify.bin'],
	['w', 'slugify', 'artifacts/slugify.wasm'],
	['c', 'clock', 'artifacts/clock.wasm']
]);

/** Declares further execution targets for a unit, each with the file its build writes. */
export async function targets(repo: VerifyRepo, unit: string, added: object[]): Promise<void> {
	const path = `specification/units/${unit}.json`;
	const manifest = await repo.json<{ runtime: { targets: object[] } }>(path);
	const runtime = { ...manifest.runtime, targets: [...manifest.runtime.targets, ...added] };
	await repo.write(path, JSON.stringify({ ...manifest, runtime }));
}

/**
 * Rebuilds a unit at other sizes and commits that. Only the digits of the comment change: the
 * source keeps its length, and no function changes, so no reason is asked for.
 */
export async function resized(repo: VerifyRepo, file: string, digits: string): Promise<string> {
	const path = `src/utils/${file}.ts`;
	const source = await repo.read(path);
	await repo.write(path, source.replace(/\/\/ build:.*\n/, `// build: ${digits}\n`));
	await repo.harness(['units', 'index', '--write']);
	return repo.commit(`build: ${file} at ${digits}`);
}

/**
 * A verified fixture with baselines in which slugify is built for a process and for Wasm, three
 * and five bytes, and the clock declares a Wasm output that the build does not produce yet.
 */
export function emittedRepo(): Promise<VerifyRepo> {
	return baselineRepo(async (repo) => {
		await targets(repo, 'function.slugify', [
			{ kind: 'process', entry: 'artifacts/slugify.bin' },
			{ kind: 'wasm', entry: 'artifacts/slugify.wasm' }
		]);
		await targets(repo, 'function.clock', [{ kind: 'wasm', entry: 'artifacts/clock.wasm' }]);
		for (const [file, digits] of [
			['slugify', 'p3 w5'],
			['clock', 'c0']
		]) {
			const path = `src/utils/${file}.ts`;
			await repo.write(path, `// build: ${digits}\n${await repo.read(path)}`);
		}
		const config = await repo.json<Record<string, unknown>>('harness.verify.json');
		const built = { ...config, setup: [{ command: setup }], outputs: ['artifacts/'] };
		await repo.write('harness.verify.json', JSON.stringify(built));
		await repo.harness(['units', 'index', '--write']);
	});
}

export async function events(repo: VerifyRepo, unit: string): Promise<LedgerEvent[]> {
	const lines = (await repo.read(ledger)).split('\n').filter(Boolean);
	return lines
		.map((line) => JSON.parse(line) as LedgerEvent)
		.filter((event) => event.unit === unit);
}

/** The emitted-size findings of one unit, by target. */
export function emitted(
	record: { budgets: { findings: EmittedFinding[] } },
	unit: string
): Record<string, EmittedFinding> {
	const found = record.budgets.findings.filter(
		(item) => item.unit === unit && item.metric === 'artifact-bytes'
	);
	return Object.fromEntries(found.map((item) => [item.target ?? 'none', item]));
}

export type { EmittedFinding, LedgerEvent } from './emittedRepo.types';
