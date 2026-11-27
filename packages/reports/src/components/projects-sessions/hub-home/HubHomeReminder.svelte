<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_wppzl5o65z -->
<script lang="ts">
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import type {
		HomeChatInput,
		HomeChatReceipt,
		HomeReminder
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import {
		reminderNextTime,
		snoozeChoices
	} from '$reports/lib/projects-sessions/hub-home/reminderTimes';
	import type { SendHomeChat } from './hubHomeView.types';

	let {
		reminder,
		now,
		send,
		receipt
	}: {
		reminder: HomeReminder;
		now: number;
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
	} = $props();
	let busy = $state(false);
	let snoozing = $state(false);
	let status = $state('');
	/** The armed time already acted on; the buttons return when the Tracker shows a new one. */
	let acted = $state<string | null>(null);
	const open = $derived(acted !== reminder.at);
	const next = $derived(reminderNextTime(reminder.at, now));
	const refused = 'Not changed: the reminder moved, or your Mac needs the latest Harness app.';

	async function tap(until?: string) {
		if (busy) return;
		const message: HomeChatInput = {
			id: crypto.randomUUID(),
			agentId: 'personal',
			itemId: reminder.itemId,
			kind: until ? 'reminder-snooze' : 'reminder-done',
			question: null,
			text: until ? 'Snooze' : 'Done',
			armed: reminder.at,
			...(until && { until })
		};
		const armed = reminder.at;
		busy = true;
		snoozing = false;
		status = 'Sending…';
		try {
			await follow(message.id, armed, await send(message));
		} catch {
			status = 'Could not send. Try again.';
		} finally {
			busy = false;
		}
	}

	async function follow(id: string, armed: string, result: HomeChatReceipt) {
		if (result.status === 'queued') {
			acted = armed;
			status = 'Waiting for your Mac…';
		}
		for (let attempt = 0; attempt < 15 && result.status === 'queued'; attempt++) {
			await new Promise((done) => setTimeout(done, 2000));
			result = await receipt(id).catch(() => result);
		}
		if (result.status === 'sent') {
			acted = armed;
			status = 'Saved';
		} else if (result.status === 'refused') {
			acted = null;
			status = refused;
		} else status = 'Your Mac has not confirmed it yet.';
	}
</script>

<hx-li class="hh-reminder" data-due={next.due}>
	<hx-div class="hh-reminder-text">
		<hx-span class="hh-reminder-title"><LinkifiedText text={reminder.title} /></hx-span>
		<hx-span class="hh-reminder-meta">
			<hx-span class="hh-reminder-when">{next.label}</hx-span>
			{#if reminder.repeats}<hx-span>{reminder.repeats}</hx-span>{/if}
		</hx-span>
	</hx-div>
	{#if open}
		<hx-div class="hh-reminder-actions">
			<hx-button
				type="button"
				class="po-action"
				aria-label={`Done: ${reminder.title}`}
				disabled={busy}
				onclick={() => void tap()}>Done</hx-button
			>
			<hx-button
				type="button"
				class="po-action"
				aria-label={`Snooze: ${reminder.title}`}
				aria-expanded={snoozing}
				disabled={busy}
				onclick={() => (snoozing = !snoozing)}>Snooze</hx-button
			>
		</hx-div>
	{/if}
	{#if open && snoozing}
		<hx-div class="hh-reminder-snooze" role="group" aria-label="Snooze until">
			{#each snoozeChoices(now) as choice (choice.label)}
				<hx-button type="button" class="po-action" onclick={() => void tap(choice.until)}
					>{choice.label}</hx-button
				>
			{/each}
		</hx-div>
	{/if}
	{#if status}<hx-p class="hh-reminder-status" role="status">{status}</hx-p>{/if}
</hx-li>
