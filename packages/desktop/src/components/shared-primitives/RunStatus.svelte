<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import type { CatalogEntity } from '../../models/development-tooling/Desktop.types';
	import ReferenceText from '../explorer-ui/reference-text/ReferenceText.svelte';
	let {
		text,
		active,
		cancel,
		workspace,
		entity = null
	}: {
		text: string;
		active: boolean;
		cancel: () => void;
		workspace: Workspace;
		entity?: CatalogEntity | null;
	} = $props();
</script>

{#if text}<hx-div class="run-status" role="status">
		<hx-span><ReferenceText {text} {workspace} {entity} /></hx-span>{#if active}<hx-button
				onclick={cancel}>Cancel run</hx-button
			>{/if}
	</hx-div>{/if}
