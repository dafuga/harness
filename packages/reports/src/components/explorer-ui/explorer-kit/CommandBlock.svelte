<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_chfbh7n647 -->
<script lang="ts">
	/** A labelled command for the reader to copy and run. */
	let { label, command }: { label: string; command: string } = $props();
</script>

<hx-figure class="ex-command">
	<hx-figcaption>{label}</hx-figcaption>
	<hx-pre><hx-code>{command}</hx-code></hx-pre>
</hx-figure>

<style>
	.ex-command {
		display: grid;
		gap: var(--hx-space-6);
		min-width: 0;
	}
	.ex-command figcaption {
		color: var(--ex-muted);
		font-size: var(--hx-type-size-compact);
	}
	.ex-command pre {
		margin: 0;
		padding: var(--hx-space-10) var(--hx-space-12);
		border: var(--hx-border-thin) solid var(--ex-line);
		border-radius: var(--hx-radius-small);
		background: var(--hx-color-background);
		color: var(--ex-text);
		font-size: var(--hx-type-size-sm);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
