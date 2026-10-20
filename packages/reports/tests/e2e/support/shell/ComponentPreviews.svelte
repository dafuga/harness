<script lang="ts">
	import { setContext } from 'svelte';
	import cards from '../../../../../../specification/units/reports.component.provider-picker-cards.json';
	import account from '../../../../../../specification/units/hub.component.account-menu.json';
	import AccountMenu from '../../../../../hub/src/components/AccountMenu.svelte';
	import { key } from '../../../../../hub/src/utils/browserContext';
	import ProviderPickerCards from '../../../../src/components/ProviderPickerCards.svelte';
	const previewState = new URLSearchParams(location.search).get('state');
	const selection = { provider: 'openai' as const, model: 'gpt-6.1', effort: 'high' };
	const models = [
		{
			provider: 'openai' as const,
			model: 'gpt-6.1',
			label: 'GPT 6.1',
			efforts: ['high'],
			defaultEffort: 'high'
		}
	];
	let cancelled = $state(false);
	const session = $state({
		actor: { id: 'fixture-person', name: 'Ada Example', email: 'ada@example.invalid' } as {
			id: string;
			name: string;
			email: string;
		} | null,
		busy: false,
		signOut: async () => {
			session.actor = null;
		}
	});
	setContext(key, { session });
</script>

<div class="hx-shell">
	<main class="hx-main">
		{#if previewState === 'account'}
			<h1>{account.title}</h1>
			<div class="hub-page">
				<nav class="account" aria-label="Account menu">
					<AccountMenu projectId="fixture-project" />
				</nav>
			</div>
		{:else}
			<h1>{cards.title}</h1>
			<div class="provider-picker">
				<ProviderPickerCards
					active={{ selection, idle: true, clients: 1, observedAt: '2026-10-20T10:00:00Z' }}
					request={cancelled
						? null
						: {
								id: 'fixture-switch',
								sessionId: 'fixture-session',
								target: selection,
								status: 'pending',
								createdAt: '2026-10-20T10:01:00Z',
								reason: ''
							}}
					{models}
					providers={{ openai: 'OpenAI' }}
					locked={false}
					oncancel={() => (cancelled = true)}
				/>
			</div>
		{/if}
	</main>
</div>
