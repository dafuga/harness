<script lang="ts">
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import { timeLabel } from '../utils/timeLabel';
	import HostedConnection from './HostedConnection.svelte';
	import RemoteConnection from './RemoteConnection.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	const place = $derived(
		workspace.capabilities.source === 'github' ? 'Shared project · GitHub' : 'Local project'
	);
	const limit = $derived(workspace.capabilities.comments ? 'comments only' : 'read-only');
	const state = $derived.by(() => {
		const snapshot = workspace.snapshot;
		if (workspace.busy || !snapshot) return 'Loading project…';
		if (workspace.offline) return 'Offline cached view';
		if (snapshot.writable) return place;
		if (workspace.pinned || !snapshot.revision.atTip) return `Historical commit · ${limit}`;
		return `${place} · ${limit}`;
	});
	/** A cached copy is named as one; a local revision is never called published. */
	const cache = $derived.by(() => {
		const provenance = workspace.snapshot?.cache;
		const saved = workspace.offline?.cachedAt;
		if (workspace.offline)
			return `Read-only${saved ? ' · saved ' + timeLabel(saved) : ''} · not checked with the server`;
		if (!provenance) return '';
		if (provenance.status === 'offline') return 'Offline · showing the cached copy';
		return provenance.publication === 'local-unpublished' ? 'Local revision · not published' : '';
	});
</script>

<footer class="status-bar">
	<span>{state}</span>{#if cache}<span class="cache-state">{cache}</span>{/if}<HostedConnection
		{workspace}
		compact
	/><RemoteConnection {workspace} compact /><span
		>{workspace.snapshot?.revision.commit.slice(0, 7)}</span
	>
</footer>
