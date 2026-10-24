<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import Select from '$shared/Select.svelte';
	import SegmentedChoice from '../../shared-primitives/SegmentedChoice.svelte';
	import type {
		DesignVersion,
		EntityDetail,
		Region,
		ThreadInfo
	} from '../../../models/development-tooling/Desktop.types';
	import type { Workspace } from '../../../lib/stores/projects-sessions/workspace.svelte';
	import { imageUrl } from '../../../utils/development-tooling/imageUrl';
	import { priorImage } from './priorImage';
	import {
		imageTarget,
		optionImages,
		type ThreadTarget
	} from '../../../utils/explorer-ui/threadAnchor';
	import AnnotatedImage from '../../shared-primitives/AnnotatedImage.svelte';
	import PriorImage from '../../shared-primitives/PriorImage.svelte';
	let {
		entity,
		workspace,
		annotatable,
		version = $bindable(''),
		option = $bindable(''),
		onthread,
		onannotate
	}: {
		entity: EntityDetail;
		workspace: Workspace;
		/** Whether an image or a region of it can start a thread here. */
		annotatable: boolean;
		version?: string;
		/** The design option shown, of a version that has options; empty otherwise. */
		option?: string;
		onthread: (thread: ThreadInfo) => void;
		onannotate: (target: ThreadTarget) => Promise<void>;
	} = $props();
	let viewport = $state('desktop');
	let imageState = $state('default');
	let url = $state('');
	let error = $state('');
	const current = $derived(entity.versions.find((v) => v.version === version));
	/** Options are alternatives of one version: only the images of the option shown are offered. */
	const choices = $derived(current?.options ?? []);
	const images = $derived(optionImages(current, option));
	const named = (id: string) => `Option ${choices.findIndex((item) => item.id === id) + 1}`;
	const chosen = $derived(choices.find((item) => item.id === option));
	const caption = $derived(chosen ? ` ${named(chosen.id)}` : '');
	/** The plan of a function is notes and cases: no image of it is chosen, asked for or drawn. */
	const headless = $derived(entity.category === 'functions');
	const selected = $derived(
		headless ? undefined : images.find((i) => i.viewport === viewport && i.state === imageState)
	);
	/** Only a commit view has a commit whose change can be shown as before and after. */
	const viewed = $derived(workspace.pinned ? (workspace.snapshot?.revision.commit ?? null) : null);
	const before = $derived(priorImage(entity.versions, { version, image: selected }, viewed));
	$effect(() => {
		if (!images.some((image) => image.viewport === viewport))
			viewport = images[0]?.viewport || 'desktop';
		const states = images.filter((image) => image.viewport === viewport);
		if (!states.some((image) => image.state === imageState))
			imageState = states[0]?.state || 'default';
	});
	const threads = $derived(
		entity.threads.filter((t) => t.version === version && t.imageSha256 === selected?.sha256)
	);
	$effect(() => {
		if (!entity.versions.some((v) => v.version === version))
			version = entity.versions.at(-1)?.version || '';
	});
	$effect(() => {
		const request = selected && { entityId: entity.id, version, sha256: selected.sha256 };
		return imageUrl(workspace, request || null, (value, cause) => {
			url = value;
			error = cause;
		});
	});
	async function comment(region: Region | null) {
		if (!selected || !annotatable) return;
		try {
			await onannotate(imageTarget(version, selected, region));
		} catch (cause) {
			error = String(cause);
		}
	}
	const proposed = 'A plan is what is proposed. What the tests observed is under Overview.';
	const earlier =
		' This version also recorded a picture; it stays in the history and is not shown for a function.';
	/** What an entity without a version says: how to start one, or that none was committed. */
	const empty = $derived(
		headless
			? {
					planning: 'Use Plan to describe the behavior and its cases.',
					committed: 'No plan has been committed for this function.'
				}
			: {
					planning: 'Use Plan to describe the first design.',
					committed: 'No design has been committed for this entity.'
				}
	);
	function imageLabel(v: DesignVersion) {
		return `${v.version}${v.approval?.current ? ' · Approved' : ''}`;
	}
</script>

<hx-section class="panel design-panel">
	<hx-div class="row">
		<hx-h2>{headless ? 'Plan' : entity.planned ? 'Proposed ' + entity.kind : 'Design'}</hx-h2>
		{#if current}{#if !headless}<hx-span class="chip">{current.generator}</hx-span>{/if}<Select
				label={headless ? 'Plan version' : 'Design version'}
				bind:value={version}
				>{#each entity.versions as v (v.version)}<hx-option value={v.version}
						>{imageLabel(v)}</hx-option
					>{/each}</Select
			><hx-small>Committed {headless ? 'plan' : 'design'} · {version}</hx-small>{/if}
	</hx-div>
	{#if current && choices.length}<hx-div class="design-options">
			<SegmentedChoice
				label="Design option"
				options={choices.map((item) => named(item.id))}
				bind:value={
					() => (chosen ? named(chosen.id) : ''),
					(value) => (option = choices[Number(value.slice(7)) - 1]?.id ?? option)
				}
			/>{#if chosen}<hx-small class="option-direction">{chosen.direction}</hx-small>{/if}
		</hx-div>{/if}
	{#if current && selected}<hx-div class="design-controls">
			<SegmentedChoice
				label="Viewport"
				bind:value={viewport}
				options={[...new Set(images.map((image) => image.viewport))]}
			/>
			<SegmentedChoice
				label="Image state"
				bind:value={imageState}
				options={[
					...new Set(
						images.filter((image) => image.viewport === viewport).map((image) => image.state)
					)
				]}
			/>
		</hx-div>
		<hx-div class:before-after={before}>
			{#if before}<PriorImage
					{workspace}
					entityId={entity.id}
					version={before.version}
					sha256={before.sha256}
					title={`${entity.title} ${before.version} ${selected.viewport} ${selected.state}`}
				/>{/if}{#if url}<AnnotatedImage
					src={url}
					title={`${entity.title} ${version}${caption} ${selected.viewport} ${selected.state}`}
					caption={before ? `After · ${version}` : ''}
					{threads}
					writable={annotatable}
					{comment}
					select={onthread}
				/>{:else}<hx-p class="empty">{error || 'Loading design image…'}</hx-p>{/if}
		</hx-div>{:else if current}<hx-article class="behavior-notes">
			<hx-h3>Planned behavior</hx-h3>
			<hx-p>{current.notes || 'No behavior notes recorded for this version.'}</hx-p>
			{#if headless}<hx-p class="muted">{proposed}{current.images.length ? earlier : ''}</hx-p>{/if}
		</hx-article>{:else}<hx-div class="empty">
			<hx-h3>{headless ? 'No plan yet' : 'No design image yet'}</hx-h3>
			<hx-p>{workspace.capabilities.planning ? empty.planning : empty.committed}</hx-p>
		</hx-div>{/if}
	{#if error && url}<hx-p class="error" role="alert">{error}</hx-p>{/if}
	{#if entity.category === 'pages'}<hx-div class="row measures">
			<hx-span>Size · {entity.size.text || 'Not measured'}</hx-span><hx-span
				>Performance · {entity.performance.text || 'Not measured'}</hx-span
			>
		</hx-div>{/if}
</hx-section>
