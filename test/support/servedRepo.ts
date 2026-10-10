import { runCommand } from './cli';
import { servedSources } from './servedFixture';
import { fixtureScenarios, fixtureSources } from './verifyFixture';
import { baselineRepo, type VerifyOutcome, type VerifyRepo } from './verifyRepo';

export interface ServedOptions {
	/** Leave the build undeclared, as a project that has not adopted build identity would. */
	undeclared?: boolean;
}

/**
 * The baseline fixture with a page that is compiled by setup and captured from a real HTTP
 * server. The compiled directory is a declared build, and the page evidence names it.
 */
export function servedRepo(options: ServedOptions = {}): Promise<VerifyRepo> {
	return baselineRepo(async (repo) => {
		for (const [path, text] of Object.entries(servedSources)) await repo.write(path, text);
		const page = fixtureScenarios.find((scenario) => scenario.id === 'titles-page') as unknown as {
			tests: object[];
			evidence: object[];
		};
		const build = options.undeclared ? {} : { build: 'site' };
		const test = { id: 'page', kind: 'e2e', runner: 'command', target: 'node scripts/served.mjs' };
		await repo.write(
			'specification/scenarios/titles-page.json',
			JSON.stringify({
				...page,
				tests: [test],
				evidence: page.evidence.map((entry) => ({ ...entry, ...build }))
			})
		);
		const config = JSON.parse(fixtureSources['harness.verify.json']) as object;
		await repo.write(
			'harness.verify.json',
			JSON.stringify({
				...config,
				setup: [{ command: 'node scripts/build.mjs build' }],
				outputs: ['build/'],
				...(options.undeclared ? {} : { builds: [{ id: 'site', directory: 'build' }] })
			})
		);
	});
}

/** Compiles the checked-out source into `directory`, outside any verification snapshot. */
export async function compileBundle(repo: VerifyRepo, directory: string): Promise<void> {
	await runCommand(['node', 'scripts/build.mjs', directory], repo.root);
}

/** The identity Harness computes for a build directory through its public command. */
export async function identityOf(repo: VerifyRepo, directory: string): Promise<string> {
	const result = await repo.run(['verify', 'identity', directory, '--json']);
	return (JSON.parse(result.stdout) as { buildId: string }).buildId;
}

export function pageCaptures(outcome: VerifyOutcome) {
	const page = outcome.record.scenarios.find((scenario) => scenario.id === 'titles-page');
	return (page?.states ?? []).flatMap((state) => state.captures);
}
