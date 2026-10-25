<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	let { label = 'ExplorerModuleResourcesScreen' }: { label?: string } = $props();
</script>

<hx-section data-harness-component="explorer-module-resources-screen">
	<hx-h2>{label}</hx-h2>
</hx-section>
