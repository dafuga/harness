<script lang="ts">
	import Select from '$shared/Select.svelte';
	import { onMount } from 'svelte';
	import { agentSettings } from '../../lib/agents-providers/agent-settings/agentSettings.svelte';
	import { designCounts } from '../../utils/explorer-ui/composeModes';
	/** Preferences of this device, the same for every project and composer on it. */
	onMount(() => agentSettings.load());
</script>

<section class="agent-settings" data-harness-component="agent-settings">
	<h2>Agents</h2>
	<label class="agent-setting">
		<span>Design options</span>
		<Select
			label="Design options"
			bind:value={
				() => String(agentSettings.designOptions),
				(value) => agentSettings.setDesignOptions(Number(value))
			}
			>{#each designCounts as item (item)}<option value={String(item)}
					>{item} {item === 1 ? 'design' : 'designs'}</option
				>{/each}</Select
		>
	</label>
	<small>How many designs a Plan of a page, shell or component asks for. Kept on this device.</small
	>
	{#if !agentSettings.saved}<p class="agent-settings-error" role="alert">
			Not saved; this choice resets when the page reloads.
		</p>{/if}
</section>

<style>
	.agent-settings {
		display: grid;
		gap: var(--hx-space-10);
		max-width: 420px;
		padding: var(--hx-space-18);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-large);
		background: var(--hx-color-surface);
	}
	h2 {
		margin: 0;
		font-size: var(--hx-type-size-base);
	}
	.agent-setting {
		display: grid;
		gap: var(--hx-space-6);
	}
	.agent-setting span {
		color: var(--hx-color-primary);
		font-size: var(--hx-type-size-compact);
	}
	small {
		color: var(--hx-color-text-muted);
	}
	.agent-settings-error {
		margin: 0;
		color: var(--hx-color-error);
	}
</style>
