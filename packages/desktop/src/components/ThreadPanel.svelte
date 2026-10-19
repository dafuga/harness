<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { explorerName } from '../../../reports/src/utils/explorerName';
	import type { EntityDetail, ProviderState, ThreadInfo } from '../models/Desktop.types';
	import type { RunEvent } from '../models/DesktopBridge.types';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import { createThreadCommentsStore } from '../lib/stores/threadComments.svelte';
	import { createThreadRunStore } from '../lib/stores/threadRun.svelte';
	import { pendingEntries, requestEntry, threadInfo } from '../utils/commentEntries';
	import type { ThreadEntry } from '../utils/commentEntries';
	import { composeModes, visualCategory, type RunDraft } from '../utils/composeModes';
	import { designTarget, otherOption, shownApproval, threadAnchor } from '../utils/threadAnchor';
	import type { ThreadTarget } from '../utils/threadAnchor';
	import ApprovalButton from './ApprovalButton.svelte';
	import Composer from './Composer.svelte';
	import MessageList from './MessageList.svelte';
	import ReferenceText from './ReferenceText.svelte';
	import RunStatus from './RunStatus.svelte';
	import ThreadHistory from './ThreadHistory.svelte';
	import ThreadLinks from './ThreadLinks.svelte';
	let {
		entity,
		workspace,
		thread = $bindable(null),
		target = $bindable(null),
		version = $bindable(''),
		option = $bindable(''),
		close
	}: {
		entity: EntityDetail;
		workspace: Workspace;
		thread?: ThreadInfo | null;
		/** A region or image that was selected where no thread is opened for it yet. */
		target?: ThreadTarget | null;
		version?: string;
		/** The design option in view; empty for a design without options. */
		option?: string;
		close: () => void;
	} = $props();
	/** One workspace store lives as long as the page; its run and comments belong to this view. */
	const store = untrack(() => workspace);
	const run = createThreadRunStore(store);
	const comments = createThreadCommentsStore(store);
	let providers = $state<ProviderState[]>([]);
	let messages = $state<ThreadEntry[]>([]);
	let failure = $state('');
	let scroller = $state<HTMLDivElement>();
	const design = $derived(entity.versions.find((v) => v.version === version));
	const approved = $derived(shownApproval(design, entity.latestVersion, option));
	const modes = $derived(
		composeModes(workspace.capabilities, Boolean(workspace.snapshot?.writable))
	);
	/** A comment on a function is on the function: no earlier picture of a plan is aimed at. */
	const headless = $derived(entity.category === 'functions');
	const aim = $derived<ThreadTarget>(
		thread ?? target ?? designTarget(headless ? undefined : design, option)
	);
	/** A thread or selection on another option of this version is left; the draft stays. */
	$effect(() => {
		const shown = option;
		untrack(() => {
			if (otherOption(thread, version, shown)) thread = null;
			if (otherOption(target, version, shown)) target = null;
		});
	});
	const entries = $derived([
		...messages,
		...pendingEntries(comments.pending, entity.id, entity.threads)
	]);
	const error = $derived(failure || run.error || comments.error);
	const notice = $derived.by(() => {
		if (modes.length) return modes[0] === 'comment' ? workspace.capabilities.reason || '' : '';
		if (workspace.capabilities.agents) return 'Historical revisions are read-only.';
		return workspace.capabilities.reason || 'Commenting is not available to you in this project.';
	});
	const heading = $derived.by(() => {
		if (thread) return 'Thread #' + thread.pin;
		return target ? 'New thread' : 'New conversation';
	});
	onMount(() => {
		void comments.load();
		if (workspace.capabilities.agents)
			void workspace.bridge
				?.providers()
				.then((value) => (providers = value))
				.catch((cause) => (failure = String(cause)));
		return workspace.bridge?.onRunEvent((value) => void progress(value));
	});
	$effect(() => {
		const id = thread?.id;
		const commit = workspace.snapshot?.revision.commit;
		const context = workspace.context;
		messages = [];
		if (id && commit)
			void workspace.bridge
				?.messages({ entityId: entity.id, threadId: id, commit, ...context })
				.then((value) => {
					const shown = workspace.snapshot?.revision.commit === commit;
					if (thread?.id === id && shown && workspace.projectId === (context.projectId ?? null))
						messages = value;
				})
				.catch((cause) => (failure = String(cause)));
	});
	/** What was said last stays in view, also a draft that is only pending. */
	$effect(() => {
		if (entries.length || run.streaming) scroller?.scrollTo({ top: scroller.scrollHeight });
	});
	async function progress(value: RunEvent) {
		if (await run.event(value)) version = entity.latestVersion || version;
	}
	/** Plan and Change need a planning thread; it is opened for exactly what is in view. */
	async function planningThread() {
		if (thread) return thread;
		const created = await workspace.bridge!.openThread({
			entityId: entity.id,
			...aim,
			...workspace.context
		});
		thread = created;
		target = null;
		return created;
	}
	async function send(request: RunDraft) {
		if (request.mode === 'ask') return false;
		const mode = request.mode;
		const started = await run.start(async () => {
			const approval = request.mode === 'change' ? design?.approval : null;
			return {
				...request,
				mode,
				entityId: entity.id,
				threadId: (await planningThread()).id,
				approval: approval
					? {
							version: design!.version,
							imageHashes: approval.imageHashes,
							contractHash: approval.contractHash,
							...(approval.option ? { option: approval.option } : {})
						}
					: null,
				...workspace.context
			};
		});
		if (started) messages = [...messages, requestEntry(run.runId, request, design)];
		return started;
	}
	/** A human comment. It never opens a planning thread and never starts a run. */
	async function comment(text: string) {
		const anchor = threadAnchor(workspace.snapshot!.revision, entity.id, aim);
		const result = await comments.post({ text, anchor, threadId: thread?.id });
		if (result?.kind !== 'shared') return Boolean(result);
		await workspace.refresh();
		const saved = result.thread;
		thread =
			entity.threads.find((item) => item.id === saved.id) ??
			threadInfo(saved, entity.threads.length + 1);
		target = null;
		return true;
	}
</script>

<aside class="thread-panel" aria-label="Design conversation">
	<div class="row">
		<h2>{explorerName(entity)} · {heading}</h2>
		<button class="icon-button" aria-label="Close conversation" onclick={close}>×</button>
	</div>
	<p class="muted">
		{aim.viewport || entity.kind} · {aim.version || version || 'Initial plan'}{aim.region
			? ' · selected region'
			: ''}
	</p>
	<div class="thread-scroll" bind:this={scroller}>
		<ThreadHistory {entity} {workspace} {version} {option} select={(value) => (version = value)} />
		<h3>Conversation</h3>
		<ThreadLinks
			threads={entity.threads}
			{thread}
			{aim}
			select={(value) => {
				if (value.version === version && value.option) option = value.option;
				[thread, target] = [value, null];
			}}
		/>
		<MessageList messages={entries} {workspace} {entity} />{#if run.streaming}<p
				class="streaming"
				aria-live="polite"
			>
				<ReferenceText text={run.streaming} {workspace} {entity} />
			</p>{/if}
	</div>
	<RunStatus
		text={run.status}
		active={Boolean(run.runId)}
		cancel={() => void run.cancel()}
		{workspace}
		{entity}
	/>
	{#if error}<p class="error" role="alert">{error}</p>{/if}{#if comments.acknowledged}<p
			class="comment-saved"
			role="status"
		>
			Saved to GitHub · {comments.acknowledged.slice(0, 7)}
		</p>{/if}<Composer
		{modes}
		{providers}
		{approved}
		running={run.active || comments.busy}
		{notice}
		visual={visualCategory(entity.category)}
		{comment}
		{send}
	/>{#if design && workspace.capabilities.approval}<ApprovalButton
			{entity}
			{workspace}
			{design}
			{approved}
			{option}
		/>{/if}
</aside>
