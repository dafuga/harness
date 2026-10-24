<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import { untrack } from 'svelte';
	import {
		createSourceReaderStore,
		type SourceFiles,
		type SourceRead
	} from '../../lib/explorer-ui/stores/sourceReader.svelte';
	import SourceViewer from './SourceViewer.svelte';
	let {
		files,
		read,
		commit,
		empty
	}: {
		/** The files the host recorded for exactly this revision; all reading is done by these two. */
		files: SourceFiles;
		read: SourceRead;
		commit: string;
		empty?: string;
	} = $props();
	const reader = createSourceReaderStore();
	// Other callbacks start a new session; leaving or replacing one drops its pending answers.
	$effect(() => {
		const session = { files, read };
		untrack(() => void reader.initialise(session.files, session.read));
		return () => reader.cancel();
	});
</script>

<SourceViewer state={reader.state} {commit} {empty} onSelect={(path) => void reader.select(path)} />
