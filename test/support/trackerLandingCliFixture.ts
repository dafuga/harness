import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { withTempDir } from './temporary';
import {
	fixtureConfig,
	fixtureTrackerJson,
	freeTrackerPorts,
	startTrackerFixture,
	trackerFixtureEnv,
	trackerFixtureFiles,
	writeTrackerFixture
} from './trackerNodeProcess';

const githubFixture = `#!/bin/sh
set -eu
test "$1" = pr
case "$2" in
 view)
   head=$(git rev-parse refs/remotes/origin/feature)
   state=OPEN
   merger=null
   if test -f "$FIXTURE_REPO/merged"; then
     state=MERGED
     merger=$(printf '{"oid":"%s"}' "$(cat "$FIXTURE_REPO/merged")")
   fi
   printf '{"baseRefName":"main","headRefName":"feature","headRefOid":"%s","isCrossRepository":false,"isDraft":false,"closingIssuesReferences":[],"state":"%s","mergeCommit":%s}' "$head" "$state" "$merger"
   ;;
 merge)
   test "$3" = 7 && test "$4" = --repo && test "$5" = fixture/project && test "$6" = --squash && test "$7" = --match-head-commit
   head=$(git rev-parse refs/remotes/origin/feature)
   test "$8" = "$head"
   git -C "$FIXTURE_REPO/publisher" fetch origin >/dev/null
   git -C "$FIXTURE_REPO/publisher" merge --squash origin/feature >/dev/null
   git -C "$FIXTURE_REPO/publisher" commit -qm landed
   git -C "$FIXTURE_REPO/publisher" push origin main >/dev/null
   git -C "$FIXTURE_REPO/publisher" rev-parse HEAD > "$FIXTURE_REPO/merged"
   ;;
 *) exit 2;;
esac
`;

const checkFixture = `import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const git=(...args)=>execFileSync('/usr/bin/git',args,{encoding:'utf8'}).trim();
const [itemFlag,item,commitFlag,sha,exact,json]=process.argv.slice(2);
if (itemFlag!=='--item'||!item||commitFlag!=='--commit'||sha!==git('rev-parse','HEAD')||exact!=='--exact'||json!=='--json') process.exit(3);
const result={schemaVersion:1,status:'passed',commit:sha,testedCommit:sha,base:git('rev-parse','origin/main'),tree:git('rev-parse','HEAD^{tree}')};
writeFileSync(process.env.FIXTURE_REPO+'/check.json',JSON.stringify(result));
console.log(JSON.stringify(result));`;

function prepare(root: string) {
	const cwd = join(root, 'author'),
		publisher = join(root, 'publisher'),
		bare = join(root, 'origin.git');
	const bin = join(root, 'bin');
	for (const path of [cwd, publisher, bin]) mkdirSync(path);
	const git = (dir: string, ...args: string[]) =>
		execFileSync('/usr/bin/git', ['-C', dir, ...args], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe']
		}).trim();
	git(root, 'init', '-q', '--bare', '--initial-branch=main', bare);
	for (const dir of [cwd, publisher]) {
		git(dir, 'init', '-q', '--initial-branch=main');
		git(dir, 'config', 'user.name', 'Fixture');
		git(dir, 'config', 'user.email', 'fixture@example.invalid');
		git(dir, 'remote', 'add', 'origin', bare);
	}
	mkdirSync(join(cwd, 'scripts'));
	writeFileSync(
		join(cwd, 'package.json'),
		JSON.stringify({ scripts: { check: 'bun scripts/shared-checks.ts' } })
	);
	writeFileSync(join(cwd, 'scripts', 'shared-checks.ts'), checkFixture);
	git(cwd, 'add', '.');
	git(cwd, 'commit', '-qm', 'initial');
	git(cwd, 'push', '-u', 'origin', 'main');
	git(publisher, 'pull', 'origin', 'main');
	git(cwd, 'switch', '-qc', 'feature');
	writeFileSync(join(cwd, 'feature.txt'), 'change');
	git(cwd, 'add', '.');
	git(cwd, 'commit', '-qm', 'feature');
	git(cwd, 'push', '-u', 'origin', 'feature');
	const initial = git(cwd, 'rev-parse', 'HEAD');
	writeFileSync(join(publisher, 'sibling.txt'), 'newer sibling');
	git(publisher, 'add', '.');
	git(publisher, 'commit', '-qm', 'sibling');
	git(publisher, 'push', '-u', 'origin', 'main');
	const base = git(publisher, 'rev-parse', 'HEAD');
	// Only origin discovery and GitHub PR transport are substituted. All Git writes stay in the fixture.
	writeFileSync(
		join(bin, 'git'),
		'#!/bin/sh\nif test "$1" = remote && test "$2" = get-url; then echo https://github.com/fixture/project; else exec /usr/bin/git "$@"; fi\n',
		{ mode: 0o700 }
	);
	writeFileSync(join(bin, 'gh'), githubFixture, { mode: 0o700 });
	return { cwd, bin, initial, base, git };
}

export async function proveTrackerLandingCli() {
	await withTempDir('hnt-landing-', async (root) => {
		trackerFixtureFiles(root);
		const [api, sync] = await freeTrackerPorts(2);
		const hub = writeTrackerFixture(root, {
			...fixtureConfig(root, 'synthetic-hub', api),
			role: 'hub',
			syncPort: sync
		});
		const checkout = prepare(root);
		const server = await startTrackerFixture(hub);
		try {
			const { id } = await fixtureTrackerJson(hub, [
				'add',
				'Synthetic isolated landing',
				'--later'
			]);
			const env = trackerFixtureEnv(hub);
			const output = execFileSync(env.HARNESS_EXECUTABLE, ['tracker', 'land', id, '7'], {
				cwd: checkout.cwd,
				env: { ...env, PATH: checkout.bin + ':' + env.PATH, FIXTURE_REPO: root },
				encoding: 'utf8',
				timeout: 30000,
				stdio: ['ignore', 'pipe', 'pipe']
			});
			const check = JSON.parse(readFileSync(join(root, 'check.json'), 'utf8'));
			const merged = readFileSync(join(root, 'merged'), 'utf8').trim();
			expect(output).toContain(merged);
			expect(check.commit).not.toBe(checkout.initial);
			expect(check.base).toBe(checkout.base);
			expect(checkout.git(checkout.cwd, 'rev-parse', merged + '^')).toBe(check.base);
			expect(checkout.git(checkout.cwd, 'rev-parse', merged + '^{tree}')).toBe(check.tree);
		} finally {
			await server.stop();
		}
	});
}
