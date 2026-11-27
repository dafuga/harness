<!-- @harness-tier molecule -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<!-- @harness-uid u_2aiclyytdr -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { name, status, children }: { name: string; status: string; children: Snippet } = $props();
</script>

<hx-li class="device-row">
	<hx-span class="device-name">
		<hx-strong>{name}</hx-strong>
		<hx-small>{status}</hx-small>
	</hx-span>
	<hx-span class="device-actions">{@render children()}</hx-span>
</hx-li>

<style>
	.device-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--hx-space-6) var(--hx-space-16);
		min-height: 52px;
		padding: var(--hx-space-10) 0;
		border-top: var(--hx-border-thin) solid var(--hx-color-border);
	}
	.device-name {
		display: grid;
		gap: var(--hx-space-2);
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.device-name small,
	.device-actions {
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-xs);
	}
	.device-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--hx-space-8) var(--hx-space-12);
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.device-actions :global(button) {
		min-height: 44px;
		margin: 0;
		color: var(--hx-color-text);
	}
</style>
