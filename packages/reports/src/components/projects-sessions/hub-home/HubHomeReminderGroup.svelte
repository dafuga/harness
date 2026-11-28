<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_nns2urq6tm -->
<script lang="ts">
	import type {
		HomeChatReceipt,
		HomeReminder
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { reminderGroups } from '$reports/lib/projects-sessions/hub-home/reminderGroups';
	import type { ReminderGroup } from '$reports/lib/projects-sessions/hub-home/reminderGroups.types';
	import type { SendHomeChat } from './hubHomeView.types';
	import HubHomeReminder from './HubHomeReminder.svelte';

	let {
		group,
		now,
		send,
		receipt
	}: {
		group: ReminderGroup<HomeReminder>;
		now: number;
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
	} = $props();
	const shortList = 5;
	let all = $state(false);
	const sections = $derived(
		reminderGroups(
			all ? group.rows : group.rows.slice(0, shortList),
			(reminder) => reminder
		).find((entry) => entry.id === group.id)!.sections
	);
	const heading = $derived(`hh-reminders-${group.id}`);
</script>

<hx-section class="hh-reminders-column" aria-labelledby={heading}>
	<hx-div class="hh-reminders-head">
		<hx-h3 class="hh-reminders-group" id={heading}>{group.label}</hx-h3>
		<hx-span class="hh-reminders-count">{group.rows.length}</hx-span>
	</hx-div>
	{#each sections as section (section.project)}
		{#if section.project}
			<hx-h4 class="hh-reminders-project">{section.project}</hx-h4>
		{/if}
		<hx-ul class="hh-reminders-list" aria-label={section.project ?? group.label}>
			{#each section.rows as reminder (reminder.itemId)}
				<HubHomeReminder {reminder} {now} {send} {receipt} />
			{/each}
		</hx-ul>
	{:else}
		<hx-p class="hh-reminders-empty">{group.empty}</hx-p>
	{/each}
	{#if group.rows.length > shortList}
		<hx-button
			type="button"
			class="po-action hh-reminders-more"
			aria-expanded={all}
			onclick={() => (all = !all)}
		>
			{all ? 'Show fewer' : `Show all ${group.rows.length}`}
		</hx-button>
	{/if}
</hx-section>
