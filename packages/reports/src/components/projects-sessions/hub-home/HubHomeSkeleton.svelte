<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_veojwq4m3c -->
<script lang="ts">
	let { rows = 4 }: { rows?: number } = $props();
</script>

<hx-ul class="hh-skel-list" aria-hidden="true">
	{#each Array(rows) as _, index (index)}
		<hx-li class="hh-skel-row" data-extra={index >= 2 ? '' : undefined}>
			<hx-span class="hh-skel hh-skel-title"></hx-span><hx-span class="hh-skel hh-skel-meta"
			></hx-span>
		</hx-li>
	{/each}
</hx-ul>
