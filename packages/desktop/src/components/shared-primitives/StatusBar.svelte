<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_darknmiedb -->
<script lang="ts">
	import { shortCommit } from '$reports/helpers/strings/shortCommit';

	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import { timeLabel } from '../../utils/shared-primitives/timeLabel';
	import HostedConnection from '../networking-security/HostedConnection.svelte';
	import RemoteConnection from '../networking-security/RemoteConnection.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	/** A phone's project is its computer's: the connection line below names it, so no place is said. */
	const phone = $derived(Boolean(workspace.remote.phone));
	const place = $derived.by(() => {
		if (phone) return '';
		return workspace.capabilities.source === 'github' ? 'Shared project · GitHub' : 'Local project';
	});
	const limit = $derived(workspace.capabilities.comments ? 'comments only' : 'read-only');
	const state = $derived.by(() => {
		const snapshot = workspace.snapshot;
		if (workspace.busy || !snapshot) return 'Loading project…';
		if (workspace.offline) return 'Offline cached view';
		if (snapshot.writable) return place;
		if (workspace.pinned || !snapshot.revision.atTip) return `Historical commit · ${limit}`;
		return [place, limit].filter(Boolean).join(' · ');
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
	{#if state}<hx-span>{state}</hx-span>{/if}{#if cache}<hx-span class="cache-state">{cache}</hx-span
		>{/if}{#if !phone}<HostedConnection {workspace} compact />{/if}<RemoteConnection
		{workspace}
		compact
	/><hx-span>{shortCommit(workspace.snapshot?.revision.commit ?? '')}</hx-span>
</hx-footer>
