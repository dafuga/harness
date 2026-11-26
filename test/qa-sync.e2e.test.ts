import { execFile } from 'node:child_process';
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { rawConfig } from './services/agents-providers/qa-sync/qaSyncFixture';

/** Answers Slack and GitHub inside the CLI process and logs each request without headers. */
const network = (log: string, now: number) => `
import { appendFileSync } from 'node:fs';
const parent = {
	ts: '${(now - 60).toFixed(6)}', user: 'UBOT', text: '*Staging QA · #5 Logo*',
	reactions: [{ name: 'white_check_mark', count: 1, users: ['UJESS'] }],
	reply_count: 1, latest_reply: '${(now - 30).toFixed(6)}'
};
const reply = { ts: parent.latest_reply, user: 'UJESS', text: 'Ready for retest on prod' };
globalThis.fetch = async (input, init) => {
	const url = new URL(String(input));
	appendFileSync(${JSON.stringify(log)}, (init?.method ?? 'GET') + ' ' + url.pathname + '\\n');
	if (url.pathname.endsWith('auth.test'))
		return Response.json({ ok: true, team_id: 'T1', url: 'https://demo.slack.com/' });
	if (url.pathname.endsWith('conversations.history'))
		return Response.json({ ok: true, messages: [parent] });
	if (url.pathname.endsWith('conversations.replies'))
		return Response.json({ ok: true, messages: [parent, reply] });
	return Response.json({ labels: [] });
};
`;

async function workspace() {
	const root = await mkdtemp(join(tmpdir(), 'qa-sync-cli-'));
	const path = (name: string) => join(root, name);
	await writeFile(path('config.json'), JSON.stringify(rawConfig));
	await writeFile(path('network.mjs'), network(path('requests.log'), Date.now() / 1000));
	await writeFile(
		path('tracker'),
		`#!/bin/sh\nif [ "$1" = list ]; then echo '[]'; else printf '%s\\n' "$*" >> '${path('notes.log')}'; fi\n`
	);
	await chmod(path('tracker'), 0o755);
	return path;
}

function cli(path: (name: string) => string, ...extra: string[]) {
	const args = ['--preload', path('network.mjs'), resolve('src/cli/index.ts'), 'qa-sync'];
	args.push('--config', path('config.json'), '--state', path('state.json'));
	args.push('--tracker', path('tracker'), '--json', ...extra);
	const env = {
		...process.env,
		HARNESS_QA_SLACK_TOKEN: 'slack-test-value',
		HARNESS_QA_GITHUB_TOKEN: 'github-test-value'
	};
	return promisify(execFile)('bun', args, { env });
}

test('harness qa-sync labels, notes and remembers its work', async () => {
	const path = await workspace();
	const preview = await cli(path, '--dry-run', '--backfill-comments');
	expect(JSON.parse(preview.stdout).actions).toHaveLength(3);
	expect(await readFile(path('requests.log'), 'utf8')).not.toContain('POST');
	await expect(readFile(path('state.json'))).rejects.toThrow();

	const first = JSON.parse((await cli(path, '--backfill-comments')).stdout);
	expect(first).toMatchObject({ threads: 1, errors: [] });
	expect(await readFile(path('notes.log'), 'utf8')).toContain(
		'note inbox1 QA comment on acme/app#5'
	);
	const posts = (await readFile(path('requests.log'), 'utf8')).match(/^POST .*$/gm);
	expect(posts).toEqual(Array(2).fill('POST /repos/acme/app/issues/5/labels'));

	const second = JSON.parse((await cli(path)).stdout);
	expect(second.actions).toEqual([]);
	const stored = await readFile(path('state.json'), 'utf8');
	expect(stored + preview.stdout).not.toContain('test-value');
}, 60_000);

test('harness qa-sync refuses a token file others can read', async () => {
	const path = await workspace();
	await writeFile(path('slack-token'), 'slack-test-value');
	await chmod(path('slack-token'), 0o644);
	await expect(cli(path, '--slack-token-file', path('slack-token'))).rejects.toMatchObject({
		stderr: expect.stringContaining('readable by its owner only')
	});
});
