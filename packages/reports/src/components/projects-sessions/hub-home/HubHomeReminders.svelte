<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_vrrs2tfb4l -->
<script lang="ts">
	import type {
		HomeChatReceipt,
		HomeReminder
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import type { SendHomeChat } from './hubHomeView.types';
	import HubHomeReminder from './HubHomeReminder.svelte';

	let {
		reminders,
		now,
		send,
		receipt
	}: {
		reminders: HomeReminder[];
		now: number;
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
	} = $props();
	const shortList = 5;
	let all = $state(false);
	const listed = $derived(all ? reminders : reminders.slice(0, shortList));
</script>

<hx-section class="hh-reminders" aria-labelledby="hh-reminders-title">
	<hx-h2 class="hh-reminders-title" id="hh-reminders-title">Reminders</hx-h2>
	<hx-div class="hh-reminders-head">
		<hx-h3 class="hh-reminders-group" id="hh-reminders-personal">Personal</hx-h3>
		<hx-span class="hh-reminders-count">{reminders.length}</hx-span>
	</hx-div>
	{#if reminders.length}
		<hx-ul class="hh-reminders-list" aria-labelledby="hh-reminders-personal">
			{#each listed as reminder (reminder.itemId)}
				<HubHomeReminder {reminder} {now} {send} {receipt} />
			{/each}
		</hx-ul>
		{#if reminders.length > shortList}
			<hx-button type="button" class="po-action hh-reminders-more" onclick={() => (all = !all)}>
				{all ? 'Show fewer' : `Show all ${reminders.length}`}
			</hx-button>
		{/if}
	{:else}
		<hx-p class="hh-reminders-empty">No personal reminders.</hx-p>
	{/if}
</hx-section>
