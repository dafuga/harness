<script lang="ts">
	let { text, active, cancel }: { text: string; active: boolean; cancel: () => void } = $props();
</script>

{#if text}<div class="run-status" role="status">
		<span>{text}</span>{#if active}<button onclick={cancel}>Cancel run</button>{/if}
	</div>{/if}
