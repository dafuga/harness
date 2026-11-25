<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_p2jtepvziq -->
<script lang="ts">
	import Modal from '$shared/Modal.svelte';
	import type {
		HomeSubscription,
		OwnerHomeSnapshot
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { homeProviderReadingIsStale } from '$reports/lib/projects-sessions/hub-home/homeProviderPayload';

	let { read, isMac = false }: { read: () => Promise<OwnerHomeSnapshot>; isMac?: boolean } =
		$props();
	let open = $state(false);
	let setup = $state(false);
	let readings = $state<HomeSubscription[]>([]);
	const labels = { claude: 'Claude Code', codex: 'Codex' } as const;
	const resetFormatter = new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	$effect(() => {
		const request = read;
		let active = true;
		let pending = false;
		async function refresh() {
			if (pending || document.hidden) return;
			pending = true;
			try {
				const answer = await request();
				if (active) {
					const now = Date.now();
					readings = (answer.providers.quota ?? []).filter(
						(item) => !homeProviderReadingIsStale(item.readAt, now)
					);
				}
			} catch {
				if (active) readings = [];
			} finally {
				pending = false;
			}
		}
		void refresh();
		const timer = setInterval(() => void refresh(), 60_000);
		document.addEventListener('visibilitychange', refresh);
		return () => {
			active = false;
			clearInterval(timer);
			document.removeEventListener('visibilitychange', refresh);
		};
	});

	function resetText(at: string): string {
		return resetFormatter.format(new Date(at));
	}
</script>

<hx-button
	type="button"
	class="quiet quota-trigger"
	aria-haspopup="dialog"
	onclick={() => (open = true)}
>
	Subscription quota
</hx-button>
<Modal
	{open}
	title="Subscription quota"
	variant="text"
	onClose={() => {
		open = false;
		setup = false;
	}}
>
	{#each readings as reading (reading.id)}
		<hx-section class="quota-provider" aria-label={labels[reading.provider]}>
			<hx-h3 class="quota-line">{labels[reading.provider]}</hx-h3>
			{#each reading.limits as limit (limit.id)}
				<hx-p class="quota-line">{limit.label} · {Math.round(limit.left)}% left</hx-p>
				{#if limit.resetsAt}
					<hx-p class="muted quota-line">Resets {resetText(limit.resetsAt)}</hx-p>
				{/if}
			{/each}
			{#if reading.credits !== null}
				<hx-p class="quota-line">Credits left: {reading.credits}</hx-p>
			{/if}
		</hx-section>
	{/each}
	{#each Object.entries(labels) as [provider, name] (provider)}
		{#if !readings.some((item) => item.provider === provider)}
			<hx-p class="muted">{name} quota is unknown.</hx-p>
		{/if}
	{/each}
	{#if isMac}
		<hx-button
			type="button"
			class="quiet quota-trigger"
			aria-expanded={setup}
			onclick={() => (setup = !setup)}>Connect a subscription</hx-button
		>
		{#if setup}
			<hx-p>In Terminal on this Mac, run the sign-in command for your subscription.</hx-p>
			<hx-p>Claude Code <hx-strong>claude auth login</hx-strong></hx-p>
			<hx-p>Codex <hx-strong>codex login</hx-strong></hx-p>
		{/if}
	{:else if !readings.length}
		<hx-p class="muted">Connect subscriptions in the Harness Mac app.</hx-p>
	{/if}
</Modal>

<style>
	.quota-trigger {
		min-height: 44px;
	}

	.quota-provider + .quota-provider {
		border-top: var(--hx-border-thin) solid var(--hx-color-border);
		margin-top: 0.75rem;
		padding-top: 0.75rem;
	}

	.quota-line {
		margin: 0.25rem 0;
	}
</style>
