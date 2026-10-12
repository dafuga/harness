import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { CommitMessageService } from '../../src/services/CommitMessageService';
import { HookInstallService } from '../../src/services/HookInstallService';
import { writtenMessage } from '../../src/utils/commitMessage';
import { ownEnvironment } from '../support/cli';

// Git is the oracle: a message file is measured as what Git itself stores from it. Real
// commits are made in a temporary repository through the installed commit-msg hook.
const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/index.ts');
const identity = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@harness.invalid'];
let parent: string;
let root: string;
const at = (name: string) => join(parent, name);
// The Git configuration of whoever runs this is no part of the oracle: only the repository's is.
const own = { ...ownEnvironment(), GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
const git = (args: string[], input?: string) =>
	execFileSync('git', [...identity, '-c', 'commit.gpgsign=false', ...args], {
		cwd: root,
		input,
		env: own
	})
		.toString()
		.replace(/\n$/, '');
const script = (name: string, body: string) => {
	writeFileSync(at(name), `#!/bin/sh\n${body}\n`);
	chmodSync(at(name), 0o755);
};

interface Made {
	exitCode: number;
	stderr: string;
	/** The message file as the hook was given it, and the message Git stored from it. */
	seen: string;
	stored: string;
}
interface How {
	config?: string[];
	flags?: string[];
	/** The script that writes the message as an editor would; without one the text is given with -F. */
	editor?: string;
}

/** Commits a staged change with a message written as a person or a tool would write it. */
function commit(text: string, how: How = {}): Made {
	writeFileSync(at('text.txt'), text);
	writeFileSync(join(root, 'file.txt'), `${'x'.repeat(900)} ${Math.random()}\n`);
	git(['add', '-A']);
	const before = git(['rev-parse', 'HEAD']);
	const config = (how.config ?? []).flatMap((item) => ['-c', item]);
	const given = how.editor ? [] : ['-F', at('text.txt')];
	const done = spawnSync(
		'git',
		[
			...identity,
			'-c',
			'commit.gpgsign=false',
			...config,
			'commit',
			'-q',
			...(how.flags ?? []),
			...given
		],
		{ cwd: root, env: { ...own, GIT_EDITOR: how.editor ? at(how.editor) : ':' } }
	);
	const made = git(['rev-parse', 'HEAD']) !== before;
	const stored = made
		? git(['cat-file', 'commit', 'HEAD']).split('\n\n').slice(1).join('\n\n')
		: '';
	return {
		exitCode: done.status ?? 1,
		stderr: done.stderr.toString(),
		seen: readFileSync(at('seen.txt'), 'utf8'),
		stored
	};
}

beforeAll(async () => {
	parent = mkdtempSync(join(tmpdir(), 'harness-message-cleanup-'));
	root = at('main');
	execFileSync('git', ['init', '-q', '-b', 'main', root], { env: own });
	writeFileSync(
		join(root, 'harness.verify.json'),
		JSON.stringify({ schemaVersion: 1, writing: 1 })
	);
	git(['add', '-A']);
	git(['commit', '-q', '-m', 'chore: adopt the writing limits']);
	// A hook the project already had keeps what a commit-msg hook is given; Harness runs after it.
	writeFileSync(join(root, '.git/hooks/commit-msg'), `#!/bin/sh\ncp "$1" '${at('seen.txt')}'\n`);
	chmodSync(join(root, '.git/hooks/commit-msg'), 0o755);
	await new HookInstallService(root).install(`bun ${cli}`);
	// An editor that writes its text above what Git put into the file, as a person does.
	script('above.sh', `cat '${at('text.txt')}' "$1" > "$1.new" && mv "$1.new" "$1"`);
	// One that also deletes Git's comments, and keeps the scissors and what Git wrote below them.
	const below = `{ cat '${at('text.txt')}'; sed -n '/ >8 /,$p' "$1"; } > "$1.new" && mv "$1.new" "$1"`;
	script('below.sh', below);
}, 60_000);
afterAll(() => rmSync(parent, { recursive: true, force: true }));

const parity = `feat: parity\n\nalpha${' '.repeat(410)}\nbeta\n`;
const untidy = `\n \nfeat: parity  \n\n\n\nalpha${' '.repeat(410)}\n  beta\t\n\n\n# a hash line \n; a semicolon line\n\n\n`;

test('git stripspace and the cleaning of a message file leave the same text', () => {
	const pool = ['', ' ', '\t', 'text', 'text  ', '  indented', '# hash ', ';semi', 'tab\t', 'cr\r'];
	const texts = [parity, untidy, '', '\n\n', '# only\n', 'no newline at the end  '];
	let seed = 7;
	const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
	for (let count = 0; count < 60; count += 1)
		texts.push(
			Array.from({ length: 1 + (next() % 9) }, () => pool[next() % pool.length]).join('\n')
		);
	// A stored message is read without what is blank at its two ends, so that is not compared.
	for (const text of texts) {
		expect([text, writtenMessage(text, { cleanup: 'whitespace' })]).toEqual([
			text,
			git(['stripspace'], text).trim()
		]);
		for (const comment of ['#', ';'])
			expect([text, comment, writtenMessage(text, { cleanup: 'strip', comment })]).toEqual([
				text,
				comment,
				git(['-c', `core.commentChar=${comment}`, 'stripspace', '--strip-comments'], text).trim()
			]);
	}
}, 60_000);

test('a real commit whose message has whitespace Git drops is accepted, and stored as measured', async () => {
	const verified = () => new CommitMessageService(root).stored('HEAD~1', 'HEAD');
	const ways: Array<[string, How, string, string]> = [
		['an editor', { editor: 'above.sh' }, 'strip', '#'],
		['an editor with the diff shown', { editor: 'above.sh', flags: ['-v'] }, 'strip', '#'],
		['scissors', { editor: 'above.sh', config: ['commit.cleanup=scissors'] }, 'scissors', '#'],
		[
			'another comment character',
			{ editor: 'above.sh', config: ['core.commentChar=;'] },
			'strip',
			';'
		],
		[
			'whitespace with the diff shown',
			{ editor: 'below.sh', flags: ['-v'], config: ['commit.cleanup=whitespace'] },
			'whitespace',
			'#'
		],
		['a file', {}, 'whitespace', '#'],
		['a file, comments stripped', { config: ['commit.cleanup=strip'] }, 'strip', '#']
	];
	for (const [name, how, cleanup, comment] of ways) {
		const made = commit(untidy, how);
		expect([name, made.exitCode, made.stderr]).toEqual([name, 0, '']);
		// What the hook measured is, character for character, what Git stored.
		expect([name, writtenMessage(made.seen, { cleanup, comment })]).toEqual([name, made.stored]);
		expect([name, made.stored.startsWith('feat: parity\n\nalpha\n  beta')]).toEqual([name, true]);
		expect([name, made.stored.includes('diff --git')]).toEqual([name, false]);
		// The verification of the commit says of the stored message what the hook said of the file.
		expect([name, await verified()]).toEqual([name, []]);
	}
	// The reported message itself, written in an editor: ten characters of body are stored.
	const reported = commit(parity, { editor: 'above.sh' });
	expect([reported.exitCode, reported.stored]).toEqual([0, 'feat: parity\n\nalpha\nbeta']);
	// Git stores what a subject is indented by, and a no-break space on a last line. A stored
	// message is read without what is blank at its two ends, and the hook reads the file so.
	const ends = commit('  feat: indented\n\nbody\n\u00a0\n', { editor: 'above.sh' });
	expect([ends.exitCode, ends.stored]).toEqual([0, '  feat: indented\n\nbody\n\u00a0']);
	expect([writtenMessage(ends.seen), await verified()]).toEqual([ends.stored.trim(), []]);
}, 120_000);

test('a cleaned message that is still too long or has no prefix is refused, and a bypass is found', async () => {
	const long = `fix: long  \n\n\n${'b'.repeat(401)}   \n\n`;
	const head = git(['rev-parse', 'HEAD']);
	for (const how of [{ editor: 'above.sh' }, {}]) {
		const refused = commit(long, how);
		expect([refused.exitCode !== 0, refused.stored]).toEqual([true, '']);
		expect(refused.stderr).toContain('body has 401 characters; the limit is 400.');
		const plain = commit('\n\nadd the navbar   \n\n', how);
		expect(plain.exitCode).not.toBe(0);
		expect(plain.stderr).toContain('subject does not start with feat:, fix:, chore: or cleanup:.');
	}
	expect(git(['rev-parse', 'HEAD'])).toBe(head);
	// Made without the hook, the same message is stored, and the stored message is measured.
	const bypassed = commit(long, { flags: ['--no-verify'] });
	expect(bypassed.exitCode).toBe(0);
	const short = git(['rev-parse', 'HEAD']).slice(0, 12);
	expect(await new CommitMessageService(root).stored(head, 'HEAD')).toEqual([
		`commit ${short}: body has 401 characters; the limit is 400.`
	]);
}, 120_000);
