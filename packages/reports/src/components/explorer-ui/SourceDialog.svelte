<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	// The shared dialog's own sheet, so the desktop host draws it as the reports do.
	import '../../lib/styles/gallery.css';
	import type { SourceFiles, SourceRead } from '../../lib/explorer-ui/stores/sourceReader.svelte';
	import Modal from '../shared-primitives/Modal.svelte';
	import SourceContent from './SourceContent.svelte';
	let {
		open,
		title,
		files,
		read,
		commit,
		onClose,
		empty
	}: {
		open: boolean;
		/** The name the entity is shown under. */
		title: string;
		files: SourceFiles;
		read: SourceRead;
		commit: string;
		onClose: () => void;
		empty?: string;
	} = $props();
</script>

<!-- Read only: it changes no address and no editor, and a closed dialog reads nothing. -->
<Modal {open} title={`${title} · Source code`} variant="text" {onClose}>
	{#if open}<SourceContent {files} {read} {commit} {empty} />{/if}
</Modal>
