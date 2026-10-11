/**
 * Adds to the synthetic history a unit that is built for two execution targets, and takes it
 * through what a reader must be able to follow: an output without any limit yet, a first
 * baseline with a size for each target, a change that grows one output while the other shrinks,
 * the approval of both sizes, and an output that is no longer built. The outputs are a few
 * zero bytes written by the fixture's own setup; nothing here is a real program.
 */
import { emittedSetup, resized, targets } from '../../../test/support/emittedRepo';
import { reviewer, type VerifyOutcome, type VerifyRepo } from '../../../test/support/verifyRepo';

const unit = 'function.packer';
const file = 'src/utils/packer.ts';
const source = (digits: string, method: string) =>
	`// build: ${digits}\nexport function packer(value: string): string {\n\treturn value.${method}();\n}\n`;

export interface EmittedSeed {
	verified: (repo: VerifyRepo) => Promise<VerifyOutcome>;
	explain: (repo: VerifyRepo, behavior: string) => Promise<unknown>;
}

/** The commits it made, by what happened at each. */
export async function seedEmitted(
	repo: VerifyRepo,
	{ verified, explain }: EmittedSeed
): Promise<Record<'emitting' | 'packed' | 'swapped' | 'repacked' | 'vanished', string>> {
	await repo.write(file, source('p3 w5', 'toLowerCase'));
	const config = await repo.json<{ setup?: object[]; outputs?: string[] }>('harness.verify.json');
	const command = emittedSetup([
		['p', 'packer', 'artifacts/packer.bin'],
		['w', 'packer', 'artifacts/packer.wasm']
	]);
	const built = {
		...config,
		setup: [...(config.setup ?? []), { command }],
		outputs: [...(config.outputs ?? []), 'artifacts/']
	};
	await repo.write('harness.verify.json', JSON.stringify(built));
	await repo.harness(['units', 'index', '--write']);
	await targets(repo, unit, [
		{ kind: 'process', entry: 'artifacts/packer.bin' },
		{ kind: 'wasm', entry: 'artifacts/packer.wasm' }
	]);
	await repo.harness(['units', 'index', '--write']);
	await explain(repo, 'Adds a packer that is built as a process binary and as a Wasm module.');
	const emitting = await repo.commit('feat: add a packer built for two targets');
	// Nothing limits its outputs yet: its first record fails for the missing baseline.
	const unlimited = await verified(repo);
	await repo.harness(['budget', 'establish', unit, '--record', unlimited.record.id, ...reviewer]);
	// The titles page grew two commits earlier and nothing judged it since. A change to the
	// build judges every unit, so its size is approved here and the records that follow speak
	// about the packer alone.
	const titles = ['budget', 'approve', 'page.titles', '--record', unlimited.record.id];
	await repo.harness([...titles, ...reviewer]);
	const packed = await repo.commit('chore: baseline for the packer');
	await verified(repo);

	// The source keeps its size; the process output grows by what the Wasm output loses.
	await repo.write(file, source('p7 w1', 'toUpperCase'));
	await repo.harness(['units', 'index', '--write']);
	await explain(repo, 'Packs in upper case, which the process build needs four more bytes for.');
	const swapped = await repo.commit('feat: pack in upper case');
	const grown = await verified(repo);
	await repo.harness(['budget', 'approve', unit, '--record', grown.record.id, ...reviewer]);
	const repacked = await repo.commit('chore: approve the sizes of the packer');
	await verified(repo);

	const vanished = await resized(repo, 'packer', 'p7 w0');
	await verified(repo);
	return { emitting, packed, swapped, repacked, vanished };
}
