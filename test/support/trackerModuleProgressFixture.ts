import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import { GitAdapter } from '../../src/adapters/git-source-history/GitAdapter';
import type { compatibilityFixture } from './trackerCliCompatibilityFixture';

export async function verifyProjectModuleProgress({
	directory,
	run
}: Awaited<ReturnType<typeof compatibilityFixture>>) {
	const root = join(directory, 'harbor');
	await mkdir(join(root, 'specifications'), { recursive: true });
	const git = new GitAdapter(root);
	await git.run(['init']);
	const document = join(root, 'specifications/project-module-plan.md');
	await writeFile(document, harborPlan('Draft'));
	await commitPlan(git);
	const command = ['progress', '--project', 'harbor'];
	expect(await run(...command)).toMatchObject({
		code: 0,
		out: 'harbor: Module plan awaiting review',
		err: ''
	});

	await writeFile(document, harborPlan('Approved'));
	await commitPlan(git);
	expect(await run(...command)).toMatchObject({
		code: 0,
		out: 'harbor\nFirst release: 1 of 2 modules built (50%)\nFull: 1 of 3 modules built (33%)',
		err: ''
	});

	await writeFile(document, harborPlan('Approved').replace(/merge=\S+ proof=\S+/, ''));
	await commitPlan(git);
	expect((await run(...command)).out).toBe('harbor: Module plan unavailable');
}

async function commitPlan(git: GitAdapter) {
	await git.run(['add', '.']);
	await git.run([
		'-c',
		'user.name=Fixture',
		'-c',
		'user.email=fixture@example.com',
		'commit',
		'-m',
		'fixture plan'
	]);
	await git.run(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
}

function harborPlan(status: 'Draft' | 'Approved') {
	return [
		`**Status: ${status}**`,
		`| chain | Chain | First release | Built | Scope | Test | merge=${'a'.repeat(40)} proof=https://example.com/receipt |`,
		'| desktop | Desktop | First release | In progress | Scope | Test | — |',
		'| relay | Relay | Later | Planned | Scope | Test | — |'
	].join('\n');
}
