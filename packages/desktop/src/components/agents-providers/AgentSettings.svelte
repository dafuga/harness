<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import Select from '$shared/Select.svelte';
	import { onMount } from 'svelte';
	import { agentSettings } from '../../lib/agents-providers/agent-settings/agentSettings.svelte';
	import { designCounts } from '../../utils/explorer-ui/composeModes';
	/** Preferences of this device, the same for every project and composer on it. */
	onMount(() => agentSettings.load());
</script>

<hx-section class="agent-settings" data-harness-component="agent-settings">
	<hx-h2>Agents</hx-h2>
	<hx-label class="agent-setting">
		<hx-span>Design options</hx-span>
		<Select
			label="Design options"
			bind:value={
				() => String(agentSettings.designOptions),
				(value) => agentSettings.setDesignOptions(Number(value))
			}
			>{#each designCounts as item (item)}<hx-option value={String(item)}
					>{item} {item === 1 ? 'design' : 'designs'}</hx-option
				>{/each}</Select
		>
	</hx-label>
	<hx-small
		>How many designs a Plan of a page, shell or component asks for. Kept on this device.</hx-small
	>
	{#if !agentSettings.saved}<hx-p class="agent-settings-error" role="alert">
			Not saved; this choice resets when the page reloads.
		</hx-p>{/if}
</hx-section>

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
