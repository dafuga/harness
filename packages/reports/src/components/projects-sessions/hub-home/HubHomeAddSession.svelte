<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_8vq2nd5c1h -->
<!-- @harness-uid u_ebjbhjawbq -->
<script lang="ts">
	import { controlledIdPattern } from '$reports/lib/projects-sessions/hub-home/homeDirectAgents';
	import type { ChangeSession } from './hubHomeView.types';

	let { added, change }: { added: string[]; change: ChangeSession } = $props();
	let value = $state('');
	let busy = $state(false);
	let status = $state('');
	const valid = $derived(controlledIdPattern.test(value.trim()));

	async function run(id: string, add: boolean) {
		busy = true;
		status = '';
		try {
			await change(id, add);
			if (add) value = '';
		} catch {
			status = add ? 'Could not add that session.' : 'Could not remove that session.';
		} finally {
			busy = false;
		}
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (valid && !busy) void run(value.trim(), true);
	}
</script>

<hx-section class="hh-group hh-add-session" aria-label="Sessions you created">
	<hx-form class="hh-quick" onsubmit={submit}>
		<hx-input
			aria-label="Tracker agent of a session you created"
			placeholder="Add a session you created (Tracker agent)…"
			maxlength={64}
			bind:value
		/>
		<hx-button type="submit" class="po-action hh-primary" disabled={busy || !valid}
			>Add session</hx-button
		>
	</hx-form>
	{#each added as id (id)}
		<hx-p class="po-item-meta"
			>{id}
			<hx-button
				type="button"
				class="po-action"
				disabled={busy}
				aria-label={`Remove ${id}`}
				onclick={() => run(id, false)}>Remove</hx-button
			></hx-p
		>
	{/each}
	{#if status}<hx-p role="status">{status}</hx-p>{/if}
</hx-section>
