import { createHash } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import { VaultBrowserRecipeService } from '../../../src/services/accounts-access/VaultBrowserRecipeService';
import { vaultRecipe } from '../../../src/utils/accounts-access/vaultRecipe';
import { reviewed, syntheticRecipe } from '../../support/credential-vault/recipe';

function fixture(capture = false) {
	const script = Buffer.from(
		JSON.stringify({
			steps: [
				{
					path: '/login',
					next: '/verify',
					field: 'password',
					input: '#password',
					submit: '#continue'
				},
				{ path: '/verify', next: '/roster', field: 'otp', input: '#otp', submit: '#verify' }
			],
			identity: '#identity',
			capability: '#capability',
			otpPrompt: '#otp-channel',
			...(capture && { capture: { trigger: '#create', result: '/created', value: '#secret' } })
		})
	);
	const scriptSha256 = createHash('sha256').update(script).digest('hex');
	const input = syntheticRecipe({
		methods: [
			{ kind: 'browser', actions: ['read-roster'], reason: 'No roster API exists.', scriptSha256 }
		],
		otp: ['sms', 'email'],
		actions: [{ id: 'read-roster', mode: capture ? 'write' : 'read', start: '/roster' }],
		login: [
			{ id: 'password', url: '/login' },
			{ id: 'otp', url: '/verify' }
		]
	});
	const { review, reviewers } = reviewed(input, Date.now());
	const recipe = vaultRecipe(input, review, reviewers);
	const approval = {
		recipeDigest: recipe.digest,
		action: 'read-roster',
		method: 'browser' as const
	};
	return { recipe, approval, script };
}

test('run rejects changed script bytes before opening the sealed secret or a page', async () => {
	const input = fixture();
	const openSecret = vi.fn(() => Buffer.alloc(0));
	const newPage = vi.fn();
	const service = new VaultBrowserRecipeService({ newPage, openSecret });
	await expect(service.run({ ...input, script: Buffer.from('{}') })).rejects.toThrow(
		'reviewed script digest'
	);
	expect(openSecret).not.toHaveBeenCalled();
	expect(newPage).not.toHaveBeenCalled();
});

test.each([true, false])(
	'capture closes the action page and returns only status (store=%s)',
	async (write) => {
		const input = fixture(true);
		const credential = 'synthetic-capture-test';
		const pages = [
			capturePage({}),
			capturePage({
				'#identity': 'owner@example.test',
				'#capability': 'read-roster',
				'#secret': credential
			})
		];
		const sink = vi.fn(async (bytes: Uint8Array) => {
			expect(Buffer.from(bytes).equals(Buffer.from(credential))).toBe(true);
			if (!write) throw new Error(credential);
		});
		const service = new VaultBrowserRecipeService({
			newPage: async () => pages.shift()!,
			openSecret: () => Buffer.from('{"password":"fixture-password"}'),
			openOtp: async () => Buffer.from('{"otp":"123456"}'),
			secretDestination: (approval) => (approval === input.approval ? sink : undefined)
		});
		const handles = [...pages];
		const result = service.run(input);
		if (write) await expect(result).resolves.toBeUndefined();
		else await expect(result).rejects.toThrow(/^Secret capture stopped[.]/);
		expect(handles.map(({ close }) => close.mock.calls.length)).toEqual([1, 1]);
		expect(sink).toHaveBeenCalledTimes(1);
		expect(sink.mock.calls[0][0].every((byte) => byte === 0)).toBe(true);
	}
);

function capturePage(fields: Record<string, string>) {
	let url = '';
	return {
		url: () => url,
		goto: async (next: string) => {
			url = next;
		},
		waitForURL: async (next: string) => {
			url = next;
		},
		locator: (selector: string) => ({
			fill: async () => undefined,
			click: async () => undefined,
			textContent: async () => fields[selector] ?? 'email'
		}),
		close: vi.fn(async () => undefined)
	};
}
