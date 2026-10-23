import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitAdapter } from '../../src/adapters/git-source-history/GitAdapter';

export const completeProposal = `# Search proposal
## Overview
Implement accessible search for the existing product catalog.
## Acceptance Criteria
- Search returns matching products and explains an empty result.
## Dependencies
Reuse the existing product model and shared search field.
## Verification
Run the search unit tests and browser keyboard and empty-state checks.
## Performance
Use a representative workload of 1,000 catalog products; measure search latency and process memory through Harness.
`;

export async function taskAuditRepo() {
	const root = await mkdtemp(join(tmpdir(), 'harness-task-audit-'));
	const git = new GitAdapter(root);
	await mkdir(join(root, 'src'));
	await writeFile(join(root, '.gitignore'), '.cache/\n');
	await writeFile(join(root, 'plan.md'), completeProposal);
	await writeFile(
		join(root, 'src/search.ts'),
		'export const search = (text: string) => text.trim();\n'
	);
	await git.run(['init', '-q', '-b', 'main']);
	const commit = async () => {
		await git.run(['add', '-A']);
		await git.run([
			'-c',
			'user.name=Fixture',
			'-c',
			'user.email=fixture@harness.invalid',
			'-c',
			'commit.gpgsign=false',
			'commit',
			'-qm',
			'feat: task evidence fixture'
		]);
		return git.run(['rev-parse', 'HEAD']);
	};
	await commit();
	return { root, git, commit, dispose: () => rm(root, { recursive: true, force: true }) };
}

/** Complete structural content for app planning fixtures; it claims no runtime execution. */
export function planningProposal(overview: string): string {
	return `## Overview
${overview}
## Acceptance Criteria
- Demonstrate the requested behavior, empty states and errors during implementation.
## Dependencies
Reuse the existing registered fixture contracts and shared controls.
## Verification
During implementation, run relevant unit, integration and browser checks.
## Performance
Use representative fixture workloads to measure latency and process memory through Harness during coding.
`.trim();
}
