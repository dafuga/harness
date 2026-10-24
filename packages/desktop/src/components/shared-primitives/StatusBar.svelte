<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import { timeLabel } from '../../utils/development-tooling/timeLabel';
	import HostedConnection from '../networking-security/HostedConnection.svelte';
	import RemoteConnection from '../networking-security/RemoteConnection.svelte';
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

<hx-footer class="status-bar">
	<hx-span>{state}</hx-span>{#if cache}<hx-span class="cache-state">{cache}</hx-span
		>{/if}<HostedConnection {workspace} compact /><RemoteConnection {workspace} compact /><hx-span
		>{workspace.snapshot?.revision.commit.slice(0, 7)}</hx-span
	>
</hx-footer>
