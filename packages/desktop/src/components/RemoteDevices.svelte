<script lang="ts">
	import type { RemoteHost } from '../lib/stores/remoteHost.svelte';
	import type { RemoteDeviceInfo } from '../models/Environment.types';
	import { grantLabel } from '../utils/remoteLabels';
	import { timeLabel } from '../utils/timeLabel';
	let {
		devices,
		projects,
		store
	}: {
		devices: RemoteDeviceInfo[];
		projects: { id: string; name: string }[];
		store: RemoteHost;
	} = $props();
	/** Approved phones with exactly what each may reach. Revoking ends its sessions at once. */
	const names = $derived(new Map(projects.map((item) => [item.id, item.name])));
	const seen = (item: RemoteDeviceInfo) =>
		item.lastSeenAt ? `Last seen ${timeLabel(item.lastSeenAt)}` : 'Not connected';
</script>

{#if devices.length}<ul class="remote-devices" aria-label="Approved phones">
		{#each devices as item (item.deviceId)}<li>
				<strong>{item.name}</strong>{#each item.projectIds as id (id)}<span class="chip"
						>{names.get(id) ?? 'Project no longer listed'}</span
					>{/each}<span>{grantLabel(item)}</span><span class="muted"
					>{item.online ? 'Connected' : seen(item)}</span
				><button
					type="button"
					aria-label={`Revoke ${item.name}`}
					disabled={store.busy}
					onclick={() => void store.revoke(item.deviceId)}>Revoke</button
				>
			</li>{/each}
	</ul>{:else}<span class="muted">No phone is approved.</span>{/if}
