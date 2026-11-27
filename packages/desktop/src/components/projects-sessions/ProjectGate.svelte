<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_akqlhtaphm -->
<!-- @harness-view overview -->
<script lang="ts">
	import BrandMark from '$shared/BrandMark.svelte';
	import Modal from '$shared/Modal.svelte';
	import { resolve } from '$app/paths';
	import { getContext, type Snippet } from 'svelte';
	import type { RemotePhone } from '../../lib/stores/networking-security/remotePhone.svelte';
	import type { DesktopProject } from '../../models/projects-sessions/ProjectContext.types';
	import GameCreate from '../game-authoring/GameCreate.svelte';
	import { remoteContext } from '../../models/development-tooling/Environment.types';
	let {
		available,
		local = true,
		overview = false,
		busy,
		open,
		projects = [],
		choose,
		phone,
		children
	}: {
		available: boolean;
		/** False on a phone: its projects are those of a computer, and it has no folder to open. */
		local?: boolean;
		/** True while the bridge offers the Project Overview, which a paired phone may do too. */
		overview?: boolean;
		busy: boolean;
		open: () => void;
		projects?: DesktopProject[];
		choose?: (projectId: string) => void;
		/** Phone access settings of this computer; given, the phone hint offers them in a dialog. */
		phone?: Snippet;
		children?: Snippet;
	} = $props();
	/** The one dialog open over the home: the New project form or the phone access settings. */
	let dialog = $state<'create' | 'phone' | null>(null);
	const place = $derived(local ? 'On this device' : 'On your computer');
	const empty = $derived(
		local
			? 'Projects you open or create appear here.'
			: 'The projects of your computer appear here once this phone is connected.'
	);
	/** Only the desktop app owns a local tracker: a phone, a cloud page or a preview offers no link. */
	const overviewLink = $derived((available && local) || overview);
	/** A new project is made on this device, so a phone or a browser preview offers none. */
	const creates = $derived(available && local);
	/** A phone shows only its connect gate until its computer is online; then its projects appear. */
	const remote = getContext<{ phone: RemotePhone } | undefined>(remoteContext);
	const gated = $derived(!local && remote?.phone.status?.state !== 'online');
</script>

<hx-main class="project-gate">
	<hx-header class="gate-head">
		<hx-div class="brand-mark" role="img" aria-label="Harness"
			><BrandMark size={local ? undefined : 64} /></hx-div
		>
	</hx-header>
	{#if local}<hx-div class="gate-actions">
			<hx-button class="primary" disabled={!available || busy} aria-busy={busy} onclick={open}
				>{busy ? 'Opening project…' : 'Open project'}</hx-button
			>{#if creates}<hx-button
					type="button"
					aria-haspopup="dialog"
					onclick={() => (dialog = 'create')}>New project</hx-button
				>{/if}
		</hx-div>{/if}
	{#if local && !available}<hx-p class="muted gate-hint"
			>Browser preview · read-only. Open the desktop app to choose a local project.</hx-p
		>{/if}
	{#if gated}{#if overviewLink}<hx-p class="gate-overview"
				><hx-a class="project-overview-link" href={resolve('/projects' as '/')}
					>Project Overview</hx-a
				></hx-p
			>{/if}{:else}<hx-section class="recent-projects" aria-label="Recent projects">
			<hx-div class="recent-head">
				<hx-h2>Recent projects</hx-h2>
				{#if overviewLink}<hx-a class="project-overview-link" href={resolve('/projects' as '/')}
						>Project Overview</hx-a
					>{/if}
			</hx-div>
			{#each projects as item (item.id)}<hx-button
					type="button"
					class="recent-project"
					disabled={busy}
					aria-label={`Open ${item.name}`}
					onclick={() => choose?.(item.id)}
					><hx-strong>{item.name}</hx-strong><hx-small
						>{item.kind === 'shared' ? 'Shared project' : item.root || place}</hx-small
					>{#if !local}<hx-span class="recent-chevron" aria-hidden="true"></hx-span>{/if}</hx-button
				>{:else}<hx-p class="muted recent-empty">{empty}</hx-p>{/each}
		</hx-section>{/if}
	{#if phone}<hx-p class="phone-hint"
			><hx-span
				>Open Harness on your iPhone or the web and sign in with the same Google account.</hx-span
			><hx-button
				type="button"
				class="quiet"
				aria-haspopup="dialog"
				onclick={() => (dialog = 'phone')}>Linked devices</hx-button
			></hx-p
		>{/if}
	{#if children}<hx-div class="gate-more" class:inline={!local}>{@render children()}</hx-div>{/if}
</hx-main>
<Modal open={dialog === 'create'} title="New project" variant="text" onClose={() => (dialog = null)}
	><GameCreate /></Modal
>
<Modal
	open={dialog === 'phone'}
	title="Linked devices"
	variant="text"
	onClose={() => (dialog = null)}
	><hx-div class="gate-dialog-body">{@render phone?.()}</hx-div></Modal
>

<style>
	.project-gate {
		display: grid;
		gap: var(--hx-space-28);
		width: min(100%, 640px);
		box-sizing: border-box;
		margin: 0 auto;
		padding: 14vh var(--hx-space-24) var(--hx-space-40);
	}
	.gate-head {
		display: grid;
		justify-items: center;
		gap: var(--hx-space-8);
		text-align: center;
	}
	.gate-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--hx-space-12);
	}
	.gate-actions button {
		min-height: 44px;
		margin: 0;
	}
	.gate-overview {
		margin: 0;
		text-align: center;
	}
	.gate-hint {
		margin: 0;
		text-align: center;
	}
	.phone-hint {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--hx-space-6) var(--hx-space-12);
		margin: 0;
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-xs);
		text-align: center;
	}
	.quiet {
		min-height: 32px;
		padding: var(--hx-space-4) var(--hx-space-10);
		font-size: var(--hx-type-size-2xs);
	}
	.gate-more:not(.inline) {
		display: flex;
		justify-content: center;
		color: var(--hx-color-text-muted);
	}
	.gate-dialog-body :global(.remote-connection) {
		margin: 0;
		padding: 0;
		border: 0;
	}
</style>
