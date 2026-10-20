/**
 * Adds to the synthetic history a frame that puts the title list under a heading, and how it
 * becomes a shell: on a branch of its own it is first indexed as a component and baselined, then
 * declared a shell on its manifest alone, its id unchanged. A later commit no branch keeps is read
 * by its commit alone. Everything here is made up for the test.
 */
import { reviewer, type VerifyOutcome, type VerifyRepo } from '../../../test/support/verifyRepo';
import type { ScenarioManifest } from '../../../src/core/unitTypes';

/** The branch of the frame, with a slash an address has to encode. */
export const shellsBranch = 'feature/shells';
/** Indexed as a component first: its id says so, and only its declared kind makes it a shell. */
export const shellUnit = 'component.title-frame';
const file = 'src/components/TitleFrame.svelte';
const frame = (heading: string) =>
	[
		'<script lang="ts">',
		"\timport TitleList from './TitleList.svelte';",
		'\tlet { titles }: { titles: string[] } = $props();',
		'</script>',
		'',
		`<section><h2>${heading}</h2><TitleList {titles} /></section>`,
		''
	].join('\n');

export interface ShellsSeed {
	verified: (repo: VerifyRepo) => Promise<VerifyOutcome>;
	explain: (repo: VerifyRepo, behavior: string) => Promise<unknown>;
}

async function bindFrame(repo: VerifyRepo): Promise<void> {
	const path = `specification/units/${shellUnit}.json`;
	const unit = await repo.json(path);
	const scenarioPath = 'specification/scenarios/titles-list.json';
	const scenario = await repo.json<ScenarioManifest>(scenarioPath);
	scenario.units.push(shellUnit);
	scenario.states.push({
		id: 'frame',
		title: 'Title frame',
		coverage: 'required',
		units: [shellUnit]
	});
	scenario.evidence.find((item) => item.id === 'screens')!.states.push('frame');
	await repo.write(scenarioPath, JSON.stringify(scenario));
	await repo.write(
		path,
		JSON.stringify({
			...unit,
			scenarios: ['titles-list'],
			preview: { scenario: 'titles-list', state: 'frame', viewport: 'desktop' }
		})
	);
	await repo.harness(['units', 'index', '--write']);
}

/** The commits it made, by what the frame was at each; it leaves `main` checked out. */
export async function seedShells(
	repo: VerifyRepo,
	{ verified, explain }: ShellsSeed,
	from: string
): Promise<Record<'framed' | 'framedBaseline' | 'shelled' | 'shellRetained', string>> {
	await repo.git(['checkout', '-q', '-b', shellsBranch, from]);
	await repo.write(file, frame('Titles'));
	await repo.harness(['units', 'index', '--write']);
	await bindFrame(repo);
	await explain(repo, 'Adds a frame that puts the title list under a heading.');
	const framed = await repo.commit('feat: add a frame around the title list');
	const unlimited = await verified(repo);
	await repo.harness([
		'budget',
		'establish',
		shellUnit,
		'--record',
		unlimited.record.id,
		...reviewer
	]);
	const framedBaseline = await repo.commit('chore: baseline for the title frame');
	await verified(repo);
	// Only the declared kind changes; reindexing keeps it, with the id, the source and the budget.
	const path = `specification/units/${shellUnit}.json`;
	const manifest = await repo.json<Record<string, unknown>>(path);
	await repo.write(path, `${JSON.stringify({ ...manifest, kind: 'shell' }, null, '\t')}\n`);
	await repo.harness(['units', 'index', '--write']);
	await explain(repo, 'Declares the title frame a shell: it composes the list into a screen.');
	const shelled = await repo.commit('feat: declare the title frame a shell');
	await verified(repo);
	await repo.git(['checkout', '-q', '-b', 'feature/shell-retained']);
	const shellRetained = await repo.change(file, () => frame('All titles'));
	await verified(repo);
	await repo.git(['checkout', '-q', 'main']);
	await repo.git(['branch', '-q', '-D', 'feature/shell-retained']);
	return { framed, framedBaseline, shelled, shellRetained };
}
