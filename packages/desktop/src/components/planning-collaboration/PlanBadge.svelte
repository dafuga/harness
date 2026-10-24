<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	let { label = 'Plan' }: { label?: string } = $props();
</script>

<hx-span class="plan-badge">{label}</hx-span>
