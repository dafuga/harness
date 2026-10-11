<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		EntityDetail,
		ProviderState,
		ThreadInfo,
		ThreadMessage,
		ProviderId,
		RunMode
	} from '../models/Desktop.types';
	import type { RunEvent } from '../models/DesktopBridge.types';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import Composer from './Composer.svelte';
	import MessageList from './MessageList.svelte';
	import ThreadHistory from './ThreadHistory.svelte';
	import RunStatus from './RunStatus.svelte';
	let {
		entity,
		workspace,
		thread = $bindable(null),
		version = $bindable(''),
		close
	}: {
		entity: EntityDetail;
		workspace: Workspace;
		thread?: ThreadInfo | null;
		version?: string;
		close: () => void;
	} = $props();
	let providers = $state<ProviderState[]>([]);
	let messages = $state<ThreadMessage[]>([]);
	let error = $state('');
	let status = $state('');
	let runId = $state('');
	let streaming = $state('');
	let approving = $state(false);
	let pending = $state(false);
	const design = $derived(entity.versions.find((v) => v.version === version));
	const approved = $derived(
		Boolean(design?.approval?.current && design.version === entity.latestVersion)
	);
	onMount(() => {
		void workspace.bridge
			?.providers()
			.then((value) => (providers = value))
			.catch((cause) => (error = String(cause)));
		return workspace.bridge?.onRunEvent(event);
	});
	$effect(() => {
		const id = thread?.id;
		const commit = workspace.snapshot?.revision.commit;
		messages = [];
		if (id && commit)
			void workspace.bridge
				?.messages({ entityId: entity.id, threadId: id, commit })
				.then((value) => {
					if (thread?.id === id && workspace.snapshot?.revision.commit === commit) messages = value;
				})
				.catch((cause) => (error = String(cause)));
	});
	async function event(value: RunEvent) {
		if (value.runId !== runId) return;
		if (value.kind === 'status') status = value.detail;
		if (value.kind === 'text') streaming += value.text;
		if (value.kind === 'failed') {
			error = value.message;
			runId = '';
		}
		if (value.kind === 'cancelled') {
			status = 'Run cancelled';
			runId = '';
		}
		if (value.kind === 'failed' || value.kind === 'cancelled') await workspace.refresh();
		if (value.kind === 'finished') {
			status = value.summary;
			runId = '';
			await workspace.refresh();
			version = entity.latestVersion || version;
		}
	}
	async function initialThread() {
		if (thread) return thread;
		const image = design?.images[0];
		const created = await workspace.bridge!.openThread({
			entityId: entity.id,
			version: image ? design!.version : null,
			imageSha256: image?.sha256 || null,
			state: image?.state || null,
			viewport: image?.viewport || null,
			region: null
		});
		thread = created;
		return created;
	}
	async function send(request: {
		text: string;
		mode: RunMode;
		provider: ProviderId;
		model: string;
		effort: string | null;
	}) {
		if (pending || runId) return false;
		pending = true;
		error = '';
		streaming = '';
		try {
			const selected = await initialThread();
			const approval =
				request.mode === 'change' && design?.approval
					? {
							version: design.version,
							imageHashes: design.approval.imageHashes,
							contractHash: design.approval.contractHash
						}
					: null;
			const run = await workspace.bridge!.startRun({
				...request,
				entityId: entity.id,
				threadId: selected.id,
				approval
			});
			runId = run.runId;
			status = 'Request accepted';
			messages = [
				...messages,
				{
					id: run.runId,
					at: new Date().toISOString(),
					author: 'user',
					text: request.text,
					mode: request.mode,
					provider: request.provider,
					model: request.model,
					version: design?.version || null,
					imageSha256: design?.images[0]?.sha256 || null
				}
			];
			return true;
		} catch (cause) {
			error = String(cause);
			return false;
		} finally {
			pending = false;
		}
	}
	async function approve() {
		if (!design || !entity.contract.hash || !workspace.snapshot?.writable) return;
		approving = true;
		error = '';
		try {
			await workspace.bridge!.approve({
				entityId: entity.id,
				version: design.version,
				imageHashes: design.images.map((i) => i.sha256),
				contractHash: entity.contract.hash
			});
			await workspace.refresh();
		} catch (cause) {
			error = String(cause);
		} finally {
			approving = false;
		}
	}
	async function cancel() {
		try {
			await workspace.bridge!.cancelRun({ runId });
		} catch (cause) {
			error = String(cause);
		}
	}
</script>

<aside class="thread-panel" aria-label="Design conversation">
	<div class="row">
		<h2>{entity.title} · {thread ? 'Thread #' + thread.pin : 'New conversation'}</h2>
		<button class="icon-button" aria-label="Close conversation" onclick={close}>×</button>
	</div>
	<p class="muted">
		{thread?.viewport || entity.kind} · {thread?.version || version || 'Initial plan'}
	</p>
	<div class="thread-scroll">
		<ThreadHistory {entity} {workspace} {version} select={(value) => (version = value)} />
		<h3>Conversation</h3>
		<div class="thread-links">
			{#each entity.threads as item (item.id)}<button
					class:active={thread?.id === item.id}
					onclick={() => (thread = item)}
					>Thread {item.pin} · {item.version || 'Initial plan'}</button
				>{/each}
		</div>
		<MessageList {messages} />{#if streaming}<p class="streaming" aria-live="polite">
				{streaming}
			</p>{/if}
	</div>
	<RunStatus text={status} active={Boolean(runId)} cancel={() => void cancel()} />{#if error}<p
			class="error"
			role="alert"
		>
			{error}
		</p>{/if}<Composer
		{providers}
		writable={workspace.snapshot?.writable || false}
		{approved}
		running={Boolean(runId) || pending}
		{send}
	/>{#if design}<button
			class="primary approve"
			disabled={!workspace.snapshot?.writable ||
				!entity.contract.hash ||
				(['pages', 'components'].includes(entity.category) && !design.images.length) ||
				approved ||
				approving ||
				design.version !== entity.latestVersion}
			onclick={() => void approve()}
			>{approved ? 'Design ' + version + ' approved' : 'Approve ' + version}</button
		><small class="approval-note"
			>Approval saves the exact design. Code starts with a Change request.</small
		>{/if}
</aside>
