<script lang="ts">
	import { tick } from 'svelte';
	import HarnessAction from '../../../reports/src/components/harness/HarnessAction.svelte';
	import SourceDialog from '../../../reports/src/components/SourceDialog.svelte';
	import type {
		SourceFiles,
		SourceRead
	} from '../../../reports/src/lib/stores/sourceReader.svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import type { CatalogEntity, EntityDetail } from '../models/Desktop.types';
	let {
		entity,
		workspace,
		title,
		path
	}: {
		entity: CatalogEntity | EntityDetail;
		workspace: Workspace;
		/** The name the entity is shown under where that is not its title, as in its detail. */
		title?: string;
		path: string;
	} = $props();
	interface Session {
		scope: string;
		commit: string;
		files: SourceFiles;
		read: SourceRead;
		trigger: HTMLElement;
	}
	let named = $derived(title ?? entity.title);
	// Another project, revision or entity ends a session, so none of its answers is shown.
	let scope = $derived(
		`${workspace.projectId ?? ''}|${workspace.snapshot?.revision.commit ?? ''}|${entity.id}`
	);
	let session = $state.raw<Session | null>(null);
	$effect(() => {
		if (session && session.scope !== scope) session = null;
	});
	/** What every read names is taken now: a later answer belongs to this revision alone. */
	function open(event: MouseEvent) {
		const bridge = workspace.bridge;
		const commit = workspace.snapshot?.revision.commit;
		if (!bridge || !commit) return;
		const query = { entityId: entity.id, commit, ...workspace.context };
		const listed = 'sources' in entity ? [...entity.sources] : null;
		session = {
			scope,
			commit,
			trigger: event.currentTarget as HTMLElement,
			files: async () => [
				path,
				...(listed ?? (await bridge.entity(query)).sources).filter((file) => file !== path)
			],
			read: async (path) => (await bridge.source({ ...query, path })).text
		};
	}
	async function close() {
		const trigger = session?.trigger;
		session = null;
		await tick();
		if (trigger?.isConnected) trigger.focus();
	}
</script>

<HarnessAction
	tone="plain"
	lead="file"
	label={`View code for ${path}`}
	disabled={!workspace.bridge}
	onclick={open}>View code</HarnessAction
>
{#if session}
	<SourceDialog
		open={session.scope === scope}
		title={named}
		files={session.files}
		read={session.read}
		commit={session.commit}
		onClose={close}
	/>
{/if}
