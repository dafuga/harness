import { generateKeyPairSync, createVerify } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { GitHubAppAdapter } from '../../../src/adapters/agents-providers/GitHubAppAdapter';
import { HealthProbeAdapter } from '../../../src/adapters/agents-providers/HealthProbeAdapter';
import { TrackerCliAdapter } from '../../../src/adapters/agents-providers/TrackerCliAdapter';
import { assistantTools } from '../../../src/services/agents-providers/project-assistant-service/assistantTools';
import { redactSecrets } from '../../../src/utils/agents-providers/redactSecrets';
import { ProjectAssistantConfigValidator } from '../../../src/validators/agents-providers/ProjectAssistantConfigValidator';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

function fakeGitHub() {
	const calls: { url: string; method: string; auth: string; body?: string }[] = [];
	const call = (async (input: URL | string, init: RequestInit) => {
		const url = String(input);
		const headers = init.headers as Record<string, string>;
		calls.push({
			url,
			method: String(init.method),
			auth: headers.authorization,
			body: init.body as string
		});
		if (url.endsWith('/access_tokens'))
			return Response.json({
				token: 'ghs_' + 'a'.repeat(30),
				expires_at: new Date(Date.now() + 3_600_000).toISOString()
			});
		if (init.method === 'POST')
			return Response.json({ number: 7, html_url: 'https://github.com/o/r/issues/7' });
		return Response.json({ total_count: 2, items: [] });
	}) as typeof fetch;
	const adapter = new GitHubAppAdapter({
		appId: '5919170',
		installationId: '185725175',
		owner: 'o',
		repo: 'r',
		fetch: call,
		key: { withKey: (use) => use(pem) }
	});
	return { adapter, calls };
}

describe('GitHubAppAdapter', () => {
	test('signs an RS256 App JWT and asks for read-only permissions for reads', async () => {
		const { adapter, calls } = fakeGitHub();
		await adapter.read('/search/issues', { q: `${adapter.repoQualifier} is:open` });
		const [mint, search] = calls;
		const [head, payload, signature] = mint.auth.replace('Bearer ', '').split('.');
		const ok = createVerify('RSA-SHA256')
			.update(`${head}.${payload}`)
			.verify(publicKey, signature, 'base64url');
		expect(ok).toBe(true);
		expect(JSON.parse(Buffer.from(payload, 'base64url').toString()).iss).toBe('5919170');
		expect(JSON.parse(mint.body ?? '{}').permissions).toEqual({
			metadata: 'read',
			issues: 'read',
			contents: 'read',
			pull_requests: 'read',
			actions: 'read',
			checks: 'read'
		});
		expect(search.auth).toBe('Bearer ghs_' + 'a'.repeat(30));
	});

	test('refuses paths outside the repository, unscoped search and mutating verbs', async () => {
		const { adapter, calls } = fakeGitHub();
		await expect(adapter.read('/repos/other/x/issues')).rejects.toThrow('outside');
		await expect(adapter.read('/repos/o/r/pulls/1/merge')).rejects.toThrow('outside');
		await expect(adapter.read('/repos/o/r/issues/../../../x')).rejects.toThrow('outside');
		await expect(adapter.read('/search/issues', { q: 'is:open' })).rejects.toThrow('scoped');
		await expect(adapter.read('/user')).rejects.toThrow('outside');
		expect(calls).toHaveLength(0);
	});

	test('creates an issue with a separate issues-write token', async () => {
		const { adapter, calls } = fakeGitHub();
		const made = await adapter.createIssue({ title: 'T', body: 'B' });
		expect(made).toEqual({ number: 7, url: 'https://github.com/o/r/issues/7' });
		expect(JSON.parse(calls[0].body ?? '{}').permissions).toEqual({
			metadata: 'read',
			issues: 'write'
		});
		expect(calls[1].url).toBe('https://api.github.com/repos/o/r/issues');
	});
});

describe('TrackerCliAdapter', () => {
	const rows = [
		{ id: 'aaaaaa1234', title: 'ours', status: 'open', agent: 'demo', notes: 'a\nb' },
		{ id: 'bbbbbb1234', title: 'other project', status: 'open', agent: 'harness' },
		{ id: 'cccccc1234', title: 'private', status: 'open', agent: 'demo', sensitive: true }
	];
	const runner = async (args: readonly string[]) =>
		JSON.stringify(args[0] === 'show' ? rows.find((r) => r.id.startsWith(args[1])) : rows);

	test('lists and shows only this project’s non-sensitive items', async () => {
		const tracker = new TrackerCliAdapter({ agent: 'demo', owner: 'Demo', run: runner });
		expect((await tracker.list()).map((i) => i.id)).toEqual(['aaaaaa']);
		await expect(tracker.show('bbbbbb')).rejects.toThrow('outside');
		await expect(tracker.show('cccccc')).rejects.toThrow('outside');
		await expect(tracker.launch('bbbbbb')).rejects.toThrow('outside');
	});

	test('stamps created items with the project agent and the assistant owner', async () => {
		const seen: string[][] = [];
		const tracker = new TrackerCliAdapter({
			agent: 'demo',
			owner: 'Demo assistant',
			run: async (args) => {
				seen.push([...args]);
				return JSON.stringify({ id: 'newnew1234' });
			}
		});
		expect(await tracker.add('Do a thing', 'why')).toEqual({ id: 'newnew' });
		expect(seen[0]).toContain('--agent');
		expect(seen[0][seen[0].indexOf('--agent') + 1]).toBe('demo');
		expect(seen[0][seen[0].indexOf('--owner') + 1]).toBe('Demo assistant');
	});
});

describe('tool set and redaction', () => {
	test('exposes exactly the reviewed tools and nothing that deploys or merges', () => {
		const { adapter } = fakeGitHub();
		const tracker = new TrackerCliAdapter({ agent: 'demo', owner: 'o', run: async () => '[]' });
		const health = new HealthProbeAdapter({ staging: 'https://example.com/health' });
		const tools = assistantTools(adapter, tracker, health);
		expect(tools.map((t) => t.name)).toEqual([
			'github_search_issues',
			'github_get_issue',
			'github_get_pull',
			'github_read_file',
			'github_list_runs',
			'github_run_jobs',
			'tracker_list',
			'tracker_show',
			'health_check',
			'create_github_issue',
			'create_tracker_item',
			'launch_tracker_item'
		]);
		expect(tools.filter((t) => t.write).map((t) => t.name)).toEqual([
			'create_github_issue',
			'create_tracker_item',
			'launch_tracker_item'
		]);
		expect(tools.map((t) => t.name).join(' ')).not.toMatch(/deploy|merge|secret|push/);
	});
});

describe('tool safety', () => {
	test('refuses secret-bearing file paths', async () => {
		const { adapter, calls } = fakeGitHub();
		const tracker = new TrackerCliAdapter({ agent: 'demo', owner: 'o', run: async () => '[]' });
		const read = assistantTools(adapter, tracker, new HealthProbeAdapter({})).find(
			(t) => t.name === 'github_read_file'
		)!;
		for (const path of ['.env', 'config/.env.production', 'keys/app.pem', '.secrets/x'])
			await expect(read.run({ path })).rejects.toThrow('not readable');
		expect(calls).toHaveLength(0);
	});

	test('redacts credentials and secret paths', () => {
		const text =
			'xoxb-123456789012-abcdefghij ghp_' +
			'A'.repeat(36) +
			' sk-ant-api03-abcdefghijklmnop /home/box/.secrets/stripe-org-key password: hunter2hunter2 fine';
		const out = redactSecrets(text);
		expect(out).toBe('[redacted] [redacted] [redacted] [redacted] [redacted] fine');
	});

	test('validates configuration and rejects unknown keys or insecure health URLs', () => {
		const validator = new ProjectAssistantConfigValidator();
		const good = {
			project: 'demo',
			displayName: 'Demo',
			github: {
				owner: 'o',
				repo: 'r',
				appId: '1',
				installationId: '2',
				stagingBranch: 'staging',
				mainBranch: 'main'
			},
			tracker: { agent: 'demo', owner: 'Demo' },
			health: { staging: 'https://x.test/health' },
			writers: ['U123'],
			answerChannels: ['C123'],
			answerDirectMessages: true
		};
		expect(validator.parse(good).project).toBe('demo');
		expect(() => validator.parse({ ...good, extra: 1 })).toThrow();
		expect(() => validator.parse({ ...good, health: { staging: 'http://x.test' } })).toThrow();
		expect(() => validator.parse({ ...good, answerChannels: [] })).toThrow();
	});
});
