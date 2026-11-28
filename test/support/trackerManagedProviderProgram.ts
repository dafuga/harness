/** Synthetic Codex, Claude and Harness executable for the managed launcher fixtures. */
export const providerProgram = `
const { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { basename, join } = require('node:path');
const argv = process.argv.slice(2);
if (basename(process.argv[1]) === 'claude') {
	const mode = join(process.env.HOME, '.claude-session-fixture');
	if (!existsSync(mode)) process.exit(41);
	if (process.env.USER !== require('node:os').userInfo().username) process.exit(42);
	const startup = readFileSync(mode, 'utf8');
	if (argv[0] === 'auth' && argv[1] === 'status') {
		if (startup === 'unverified') { process.stdout.write('synthetic private diagnostic'); process.exit(2); }
		const loggedIn = startup !== 'signed-out';
		process.stdout.write(JSON.stringify({ loggedIn, authMethod: loggedIn ? 'claude.ai' : 'none' }));
		process.exit(loggedIn ? 0 : 1);
	}
	if (startup === 'onboarding' || startup === 'locked-keychain') process.exit(0);
	if (startup === 'crash') process.exit(3);
	const session = argv[argv.indexOf('--session-id') + 1];
	if (argv.includes('--session-id')) {
		const project = join(process.env.HOME, '.claude', 'projects', process.cwd().replace(/[^a-zA-Z0-9]/g, '-'));
		mkdirSync(project, { recursive: true, mode: 0o700 });
		const reply = (id, output) => ({ type: 'assistant', message: { id, model: 'claude-sonnet-5-5',
			usage: { input_tokens: 100, output_tokens: output, cache_read_input_tokens: 1000, cache_creation_input_tokens: 500 } } });
		// Claude writes one line per content block, so a message id repeats.
		writeFileSync(join(project, session + '.jsonl'), [reply('msg_1', 5), reply('msg_1', 40), reply('msg_2', 10)]
			.map(JSON.stringify).join('\\n') + '\\n', { mode: 0o600 });
	}
}
if (basename(process.argv[1]) === 'codex') {
	const timestamp = new Date().toISOString();
	const dir = join(process.env.HOME, '..', 'tracker-test-codex-transcripts',
		timestamp.slice(0, 10).replaceAll('-', '/'));
	mkdirSync(dir, { recursive: true, mode: 0o700 });
	const cwd = process.cwd();
	const usage = { input_tokens: 120, cached_input_tokens: 25, output_tokens: 10 };
	const competing = existsSync(join(process.env.HOME, '..', 'competing-codex-transcript'));
	const session = (id) => ({ type: 'session_meta', payload: { id, cwd, timestamp, base_instructions: 'x'.repeat(30 * 1024) } });
	const counters = { type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: usage },
		rate_limits: { credits: { balance: '12.50' } } } };
	for (const suffix of competing ? ['1', '2'] : ['1']) {
		const id = '9c0f0000-0000-4000-8000-00000000000' + suffix;
		writeFileSync(join(dir, 'rollout-' + timestamp + '-' + id + '.jsonl'), [
			session(id), { type: 'event_msg', payload: { type: 'user_message', message: 'synthetic transcript text' } },
			counters
		].map(JSON.stringify).join('\\n') + '\\n', { mode: 0o600, flag: 'wx' });
	}
}
const briefPath = argv.includes('--brief') ? argv[argv.indexOf('--brief') + 1] : argv.at(-1)?.match(/^Read your brief at (.+) and do that work/)[1];
appendFileSync(join(process.env.HOME, 'invoked.ndjson'), JSON.stringify({
	argv, cwd: process.cwd(), image: process.env.HARNESS_TASK_DOCKER_IMAGE ?? null,
	user: process.env.USER ?? null, secret: Boolean(process.env.FIXTURE_SECRET),
	brief: briefPath && readFileSync(briefPath, 'utf8'),
	client: JSON.parse(readFileSync(process.env.HARNESS_TRACKER_CONFIG, 'utf8')),
	legacy: process.env.HARNESS_TRACKER_LEGACY_BIN,
	guestAuthFile: process.env.HARNESS_TRACKER_GUEST_AUTH_FILE ?? null
}) + '\\n');
`;
