<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_cq64eg3f5u -->
<script lang="ts">
	import Pill from '$shared/explorer-ui/explorer-kit/Pill.svelte';
	import { shortCommit } from '$reports/helpers/strings/shortCommit';
	let {
		commit = undefined,
		readonly,
		dirty
	}: {
		/** The historical commit shown. Defaults to JavaScript undefined, showing no history chip. */
		commit?: string;
		readonly: boolean;
		/** Edits not saved yet. */
		dirty: boolean;
	} = $props();
</script>

{#if commit}<Pill as="span" variant="chip" tone="game-workspace-chip"
		>History · {shortCommit(commit)}</Pill
	>{/if}
{#if readonly && !commit}<Pill as="span" variant="chip" tone="game-workspace-chip">Read-only</Pill
	>{/if}
{#if dirty}<Pill as="span" variant="chip" tone="gold game-workspace-chip">Unsaved changes</Pill
	>{/if}
