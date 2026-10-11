/**
 * Two synthetic applications for the report and analytics fixtures, both started from one
 * template so they share its history. The site under test is one of them; the other fixture
 * directories are its own checkouts in the forms a real application has: the same repository
 * under an SSH address, a clone of a local checkout and a worktree. The second application has
 * its own repository, and nothing recorded for it may be served by the first.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { e2eFixtures } from '../src/utils/e2eFixtures';

const { site } = e2eFixtures();
export const siteRoot = site('alpha-project');
export const foreignRoot = site('beta-project');
const template = site('site-template');
const origin = {
	https: 'https://github.com/synthetic/alpha-app.git',
	ssh: 'git@github.com:synthetic/alpha-app.git',
	foreign: 'https://github.com/synthetic/beta-storefront.git'
};
/** Checkouts of the site, each reaching the same repository another way. */
const checkouts: Array<[string, 'ssh' | 'local' | 'worktree']> = [
	[site('alpha-checkout'), 'worktree'],
	[site('audio-comparison'), 'ssh'],
	[site('audio-project'), 'local'],
	[site('audio-readiness'), 'ssh'],
	[site('offline-audio'), 'local'],
	[site('offline-project'), 'ssh'],
	[site('upload-pair'), 'local'],
	[site('upload-project'), 'ssh']
];
const user = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@harness.invalid'];
const git = (cwd: string, args: string[]) =>
	execFileSync('git', [...user, '-c', 'commit.gpgsign=false', ...args], { cwd, stdio: 'pipe' });

function application(directory: string, address: string): void {
	rmSync(directory, { recursive: true, force: true });
	git(dirname(template), ['clone', '-q', template, directory]);
	git(directory, ['remote', 'set-url', 'origin', address]);
}

rmSync(template, { recursive: true, force: true });
mkdirSync(template, { recursive: true });
git(template, ['init', '-q', '-b', 'main']);
writeFileSync(join(template, 'README.md'), '# Application template\n');
git(template, ['add', '-A']);
git(template, ['commit', '-q', '-m', 'feat: application template']);
for (const [directory] of checkouts) rmSync(directory, { recursive: true, force: true });
application(siteRoot, origin.https);
application(foreignRoot, origin.foreign);
for (const [directory, kind] of checkouts) {
	if (kind === 'worktree') {
		git(siteRoot, ['worktree', 'prune']);
		git(siteRoot, ['worktree', 'add', '-q', '-b', 'checkout', directory]);
	} else {
		git(dirname(template), ['clone', '-q', siteRoot, directory]);
		if (kind === 'ssh') git(directory, ['remote', 'set-url', 'origin', origin.ssh]);
	}
}
console.log(`Site ${siteRoot} with ${checkouts.length} checkouts; foreign ${foreignRoot}.`);
