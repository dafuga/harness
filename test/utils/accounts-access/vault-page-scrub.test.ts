import { expect, test } from 'vitest';
import { vaultPageScrub } from '../../../src/utils/accounts-access/vaultPageScrub';

const canary = 'canary_' + 'Q'.repeat(40);

test('removes hidden fields, CSRF meta tags and token attributes, keeping visible content', () => {
	const { snapshot, removed } = vaultPageScrub({
		url:
			'https://console.example.test/orgs/acme/members?state=' +
			canary +
			'&page=2#access_token=' +
			canary,
		title: 'Members',
		nodes: [
			{ tag: 'meta', attributes: { name: 'csrf-token', content: canary } },
			{
				tag: 'form',
				attributes: { action: '/orgs/acme/members', 'data-session': canary },
				children: [
					{
						tag: 'input',
						type: 'hidden',
						attributes: { name: 'authenticity_token', value: canary }
					},
					{ tag: 'input', type: 'password', value: 'hunter2-synthetic' },
					{ tag: 'input', type: 'text', attributes: { name: 'search' }, value: 'alice' },
					{ tag: 'code', name: 'Key', value: 'sk_live_' + 'a'.repeat(24) },
					{ tag: 'script', value: 'window.__TOKEN__="' + canary + '"' }
				]
			},
			{ tag: 'td', role: 'cell', name: 'alice@example.test' }
		]
	});
	const text = JSON.stringify(snapshot);
	expect(text).not.toContain(canary);
	expect(text).not.toContain('hunter2-synthetic');
	expect(text).not.toContain('sk_live_');
	expect(text).toContain('alice@example.test');
	expect(text).toContain('"value":"alice"');
	expect(snapshot.url).toBe('https://console.example.test/orgs/acme/members?state=redacted&page=2');
	expect(removed).toBeGreaterThanOrEqual(7);
});
