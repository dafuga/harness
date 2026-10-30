<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	/** The written steps for setting up a plugin or generating one of its resources. */
	let { lines }: { lines: string[] } = $props();
</script>

<hx-ul class="ex-reasons mod-steps">
	{#each lines as line, position (position)}<hx-li>{line}</hx-li>{/each}
</hx-ul>

<style>
	.mod-steps {
		display: grid;
		gap: var(--hx-space-6);
		min-width: 0;
		color: var(--ex-soft);
		font-size: var(--hx-type-size-sm);
		overflow-wrap: anywhere;
	}
</style>
