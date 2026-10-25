<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	let { label = 'ExplorerModulesScreen' }: { label?: string } = $props();
</script>

<hx-section data-harness-component="explorer-modules-screen">
	<hx-h2>{label}</hx-h2>
</hx-section>
