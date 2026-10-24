<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HarnessIconName } from '../../utils/explorer-ui/harnessIcons';
	import { plainClick } from '../../utils/explorer-ui/harnessShell';
	import HarnessIcon from './HarnessIcon.svelte';
	let {
		href,
		onclick,
		disabled = false,
		tone = 'gold',
		icon,
		lead,
		label,
		children
	}: {
		/** With an address the action is a link, so a new tab can open it. */
		href?: string;
		/** A press of the button, or a plain click on the link in place of loading its page. */
		onclick?: (event: MouseEvent) => void;
		disabled?: boolean;
		tone?: 'gold' | 'plain';
		/** An icon after the words, and one before them. */
		icon?: HarnessIconName;
		lead?: HarnessIconName;
		/** A fuller name than the words, where the words alone do not say enough. */
		label?: string;
		children: Snippet;
	} = $props();
	// A click with a modifier, or with another button, is left to the browser.
	function follow(event: MouseEvent) {
		if (!onclick || !plainClick(event)) return;
		event.preventDefault();
		onclick(event);
	}
</script>

{#snippet inner()}
	{#if lead}<HarnessIcon name={lead} size={18} />{/if}
	{@render children()}
	{#if icon}<HarnessIcon name={icon} size={18} />{/if}
{/snippet}
{#if href && !disabled}
	<hx-a
		class="hx-action {tone}"
		data-harness-component="harness-harness-action"
		{href}
		aria-label={label}
		onclick={follow}>{@render inner()}</hx-a
	>
{:else}
	<hx-button
		type="button"
		class="hx-action {tone}"
		data-harness-component="harness-harness-action"
		aria-label={label}
		{disabled}
		onclick={(event) => onclick?.(event)}>{@render inner()}</hx-button
	>
{/if}
