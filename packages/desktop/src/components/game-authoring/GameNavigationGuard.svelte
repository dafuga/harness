<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	let { active }: { active: boolean } = $props();
	beforeNavigate(({ cancel, willUnload }) => {
		if (!active) return;
		if (willUnload || !window.confirm('Discard unsaved game changes?')) cancel();
	});
</script>
