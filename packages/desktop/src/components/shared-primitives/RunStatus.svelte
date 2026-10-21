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

{#if text}<div class="run-status" role="status">
		<span><ReferenceText {text} {workspace} {entity} /></span>{#if active}<button onclick={cancel}
				>Cancel run</button
			>{/if}
	</div>{/if}
