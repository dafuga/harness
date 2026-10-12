import { chmod, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { runCommand } from './support/cli';
import { harnessJson } from './support/historyRepo';
import { baselineRepo, cloneRepo, repoAt, type VerifyRepo } from './support/verifyRepo';

interface HookStatus {
	installed: boolean;
	enabled: boolean;
	stage: string;
	chained: boolean;
	stages: Array<{ stage: string; installed: boolean; chained: boolean }>;
	limitations: string[];
}

const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.ts');
const command = ['--command', `bun ${cli}`];
const identity = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@harness.invalid'];
const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');
const long = `feat: ${'s'.repeat(67)}`;
const existing = (stage: string) =>
	`#!/bin/sh\n# a ${stage} hook the project already had\necho "${stage} $(basename "\${1:-none}")" >> "$(git rev-parse --git-common-dir)/existing.log"\nexit \${EXISTING_HOOK_EXIT:-0}\n`;
/** Makes an empty commit as a person does, with the hooks Git runs for one. */
const commit = (repo: VerifyRepo, message: string[], env = {}, more: string[] = []) =>
	runCommand(
		[
			'git',
			...identity,
			'commit',
			'--allow-empty',
			...more,
			...message.flatMap((part) => ['-m', part])
		],
		repo.root,
		false,
		env
	);
const head = (repo: VerifyRepo) => repo.git(['rev-parse', 'HEAD']);
const subject = (repo: VerifyRepo) => repo.git(['log', '-1', '--format=%s']);
const status = (repo: VerifyRepo) => harnessJson<HookStatus>(repo, ['hooks', 'status']);
const install = (repo: VerifyRepo) =>
	harnessJson<HookStatus>(repo, ['hooks', 'install', ...command]);

let limited: VerifyRepo;
let plain: VerifyRepo;
beforeAll(async () => {
	// One fixture declares the writing limits in its verification config; the other never did.
	limited = await baselineRepo(async (repo) => {
		const config = await repo.json<object>('harness.verify.json');
		await repo.write('harness.verify.json', JSON.stringify({ ...config, writing: 1 }));
	});
	plain = await baselineRepo();
}, 240_000);
afterAll(() => Promise.all([limited.dispose(), plain.dispose()]));

test('a message over a limit or without its prefix is refused before the commit exists', async () => {
	const repo = await cloneRepo(limited);
	await install(repo);
	const before = await head(repo);
	const refusals: Array<[string[], string]> = [
		[[long], 'subject has 73 characters; the limit is 72.'],
		[['add the navbar'], 'subject does not start with feat:, fix:, chore: or cleanup:.'],
		[['fix: short', words(61)], 'body has 61 words; the limit is 60.'],
		[['fix: short', 'b'.repeat(401)], 'body has 401 characters; the limit is 400.'],
		// No editor is opened for this message, so Git stores the hash line: it is counted.
		[['feat: short', `# ${'x'.repeat(700)}`], 'body has 702 characters; the limit is 400.']
	];
	for (const [message, said] of refusals) {
		const refused = await commit(repo, message);
		expect([said, refused.exitCode !== 0, refused.stderr.includes(said)]).toEqual([
			said,
			true,
			true
		]);
		expect(await head(repo)).toBe(before);
	}
	// At the limits, and one character under the refused subject, the commit is made.
	expect((await commit(repo, [long.slice(0, 72), words(60)])).exitCode).toBe(0);
	expect(await subject(repo)).toBe(long.slice(0, 72));
	// What Git writes into the file of an edited message is no part of the message.
	const editor = join(repo.root, '..', 'editor.sh');
	await writeFile(
		editor,
		'#!/bin/sh\nprintf "chore: written in an editor\\n\\n" | cat - "$1" > "$1.new"\nmv "$1.new" "$1"\n'
	);
	await chmod(editor, 0o755);
	const edited = await runCommand(
		['git', ...identity, 'commit', '--allow-empty', '--status'],
		repo.root,
		false,
		{ GIT_EDITOR: editor }
	);
	expect([edited.exitCode, await subject(repo)]).toEqual([0, 'chore: written in an editor']);
	await repo.dispose();
}, 180_000);

test('hooks that were there run first for both stages, and both return byte for byte', async () => {
	const repo = await cloneRepo(limited);
	const hooks = join(repo.root, '.git/hooks');
	await mkdir(hooks, { recursive: true });
	for (const stage of ['commit-msg', 'pre-push']) {
		await writeFile(join(hooks, stage), existing(stage));
		await chmod(join(hooks, stage), 0o755);
	}
	const installed = await install(repo);
	// What a caller of the push hook read before is still there, and both stages are reported.
	expect(installed).toMatchObject({
		installed: true,
		enabled: true,
		stage: 'pre-push',
		chained: true
	});
	expect(installed.stages).toEqual([
		{ stage: 'pre-push', installed: true, chained: true },
		{ stage: 'commit-msg', installed: true, chained: true }
	]);
	expect(installed.limitations.join(' ')).toContain('git commit --no-verify');
	expect(await install(repo)).toEqual(installed);
	for (const stage of ['commit-msg', 'pre-push'])
		expect(await readFile(join(hooks, `${stage}.harness-chained`), 'utf8')).toBe(existing(stage));

	// The earlier hook gets the message file and may stop the commit; then Harness has its say.
	const before = await head(repo);
	expect((await commit(repo, ['fix: short'], { EXISTING_HOOK_EXIT: '3' })).exitCode).not.toBe(0);
	expect((await commit(repo, [long])).stderr).toContain('subject has 73 characters');
	expect(await head(repo)).toBe(before);
	expect((await commit(repo, ['fix: short'])).exitCode).toBe(0);
	const log = (await readFile(join(repo.root, '.git/existing.log'), 'utf8')).trim().split('\n');
	expect(log).toEqual(Array.from({ length: 3 }, () => 'commit-msg COMMIT_EDITMSG'));

	await harnessJson(repo, ['hooks', 'uninstall']);
	for (const stage of ['commit-msg', 'pre-push'])
		expect(await readFile(join(hooks, stage), 'utf8')).toBe(existing(stage));
	expect((await readdir(hooks)).filter((name) => name.includes('harness'))).toEqual([]);
	expect((await status(repo)).stages.map((stage) => stage.installed)).toEqual([false, false]);
	expect((await commit(repo, [long])).exitCode).toBe(0);
	await repo.dispose();
}, 180_000);

test('a sibling worktree and a repository that declares no limits are left as they were', async () => {
	const repo = await cloneRepo(limited);
	await install(repo);
	const secondRoot = join(repo.root, '..', 'second');
	await repo.git(['worktree', 'add', '-q', '-b', 'second', secondRoot]);
	const second = repoAt(secondRoot);
	expect(await status(second)).toMatchObject({ installed: true, enabled: false });
	expect((await commit(second, [long])).exitCode).toBe(0);
	await install(second);
	expect((await commit(second, [long])).exitCode).not.toBe(0);
	// Where the verification config declares no writing limits, the hook measures nothing.
	const free = await cloneRepo(plain);
	await install(free);
	expect((await commit(free, ['add the navbar', words(200)])).exitCode).toBe(0);
	await Promise.all([repo.dispose(), free.dispose()]);
}, 180_000);

test('a message that skipped the hook does not pass verification of the commit that carries it', async () => {
	const repo = await cloneRepo(limited);
	await install(repo);
	const hash = `# ${'x'.repeat(700)}`;
	expect(
		(await commit(repo, [long, hash], {}, ['--no-verify', '--cleanup=verbatim'])).exitCode
	).toBe(0);
	const short = (await head(repo)).slice(0, 12);
	const refused = await repo.verify();
	expect(refused.record.status).toBe('failed');
	expect(refused.record.failures).toEqual(
		expect.arrayContaining([
			`commit ${short}: subject has 73 characters; the limit is 72.`,
			`commit ${short}: body has 702 characters; the limit is 400.`
		])
	);
	// The same content under a message that keeps the limits is verified.
	await repo.git([
		'commit',
		'-q',
		'--amend',
		'--no-verify',
		'--allow-empty',
		'-m',
		'chore: say less'
	]);
	expect((await repo.verify()).record.status).toBe('passed');
	// A repository that declares no limits is not held to them, by the hook or by verification.
	const free = await cloneRepo(plain);
	expect((await commit(free, ['add the navbar', words(200)], {}, ['--no-verify'])).exitCode).toBe(
		0
	);
	expect((await free.verify()).record.status).toBe('passed');
	await Promise.all([repo.dispose(), free.dispose()]);
}, 300_000);
