<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_vrrs2tfb4l -->
<script lang="ts">
	import type {
		HomeChatReceipt,
		HomeReminder
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { reminderGroups } from '$reports/lib/projects-sessions/hub-home/reminderGroups';
	import type { SendHomeChat } from './hubHomeView.types';
	import HubHomeReminderGroup from './HubHomeReminderGroup.svelte';

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
	const groups = $derived(reminderGroups(reminders, (reminder) => reminder));
</script>

<hx-section class="hh-reminders" aria-labelledby="hh-reminders-title">
	<hx-h2 class="hh-reminders-title" id="hh-reminders-title">Upcoming reminders</hx-h2>
	<hx-div class="hh-reminders-groups">
		{#each groups as group (group.id)}
			<HubHomeReminderGroup {group} {now} {send} {receipt} />
		{/each}
	</hx-div>
</hx-section>
