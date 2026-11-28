<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_4xehomolte -->
<script lang="ts">
	import EmptyState from '$shared/explorer-ui/explorer-kit/EmptyState.svelte';
	import Pill from '$shared/explorer-ui/explorer-kit/Pill.svelte';
	import Select from '$shared/Select.svelte';
	import SegmentedChoice from '../../shared-primitives/SegmentedChoice.svelte';
	import type {
		DesignVersion,
		EntityDetail,
		Region,
		ThreadInfo
	} from '../../../models/development-tooling/Desktop.types';
	import type { Workspace } from '../../../lib/stores/projects-sessions/workspace.svelte';
	import { imageUrl } from '../../../utils/reports-media/imageUrl';
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
		inline = false,
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
		/** The Overview's planned design: one given version, with no version picker or measures. */
		inline?: boolean;
		onthread: (thread: ThreadInfo) => void;
		onannotate: (target: ThreadTarget) => Promise<void>;
	} = $props();
	let viewport = $state('desktop');
	let imageState = $state('default');
	let url = $state('');
	let error = $state('');
	const current = $derived(entity.versions.find((v) => v.version === version));
	const choices = $derived(current?.options ?? []);
	const images = $derived(optionImages(current, option));
	const named = (id: string) => `Option ${choices.findIndex((item) => item.id === id) + 1}`;
	const chosen = $derived(choices.find((item) => item.id === option));
	const caption = $derived(chosen ? ` ${named(chosen.id)}` : '');
	/** The plan of a function is notes and cases: no image of it is chosen, asked for or drawn. */
	const headless = $derived(entity.category === 'functions');
	/** A mockup holds its own befores: `before-<state>` is the current build of `<state>`. */
	const mockup = $derived(Boolean(current?.mockup) && !headless);
	const after = $derived(mockup ? images.filter((i) => !i.state.startsWith('before-')) : images);
	const px = (key: string) => Number(/^width-(\d+)$/.exec(key)?.[1] ?? Infinity);
	const sizes = new Map([
		[390, 'Phone'],
		[834, 'Tablet'],
		[1440, 'Laptop'],
		[1920, 'Wide']
	]);
	/** `width-1440` reads `Laptop · 1440px`; another width, `Npx`; a legacy viewport, its name. */
	function sized(key: string) {
		const width = px(key);
		if (width === Infinity) return key;
		return sizes.has(width) ? `${sizes.get(width)} · ${width}px` : `${width}px`;
	}
	const viewports = $derived.by(() => {
		const keys = [...new Set(after.map((image) => image.viewport))];
		return mockup ? keys.sort((a, b) => px(a) - px(b)) : keys;
	});
	const states = $derived([
		...new Set(after.filter((i) => i.viewport === viewport).map((i) => i.state))
	]);
	const selected = $derived(
		headless ? undefined : after.find((i) => i.viewport === viewport && i.state === imageState)
	);
	const paired = $derived(
		mockup && selected
			? images.find((i) => i.viewport === viewport && i.state === `before-${selected.state}`)
			: undefined
	);
	const viewed = $derived(workspace.pinned ? (workspace.snapshot?.revision.commit ?? null) : null);
	const before = $derived(
		mockup
			? paired && { version, sha256: paired.sha256 }
			: priorImage(entity.versions, { version, image: selected }, viewed)
	);
	/** What the Before slot of a mockup says when it has no current image to pair. */
	const unbuilt = $derived(entity.planned ? 'Not built yet.' : 'No current capture of this view.');
	$effect(() => {
		if (!viewports.includes(viewport))
			viewport =
				(mockup && viewports.includes('width-1440') ? 'width-1440' : viewports[0]) || 'desktop';
		if (!states.includes(imageState)) imageState = states[0] || 'default';
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
		return `${v.version}${v.mockup ? ' · Mockup' : ''}${v.approval?.current ? ' · Approved' : ''}`;
	}
	const proposal = $derived(entity.planned ? `Proposed ${entity.kind}` : 'Design');
	const kind = $derived(headless ? 'plan' : mockup ? 'mockup' : 'design');
	const status = $derived(entity.lifecycle === 'approved' ? 'Approved' : 'In review');
</script>

<hx-section class="panel design-panel">
	<hx-div class="row">
		<hx-h2>{inline ? 'Planned design' : headless ? 'Plan' : proposal}</hx-h2>
		{#if current}{#if !headless}<Pill as="span" variant="chip" tone="design-panel-chip"
					>{inline ? status : current.generator}</Pill
				>{/if}{#if inline}<hx-small>Latest {kind} · {version}</hx-small>{:else}<Select
					label={headless ? 'Plan version' : 'Design version'}
					bind:value={version}
					>{#each entity.versions as v (v.version)}<hx-option value={v.version}
							>{imageLabel(v)}</hx-option
						>{/each}</Select
				><hx-small>Committed {kind} · {version}</hx-small>{/if}{/if}
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
	{#if current && selected}<hx-div
			class="design-controls"
			class:highlight-fixed-viewport={!inline && viewports.length === 1 && states.length === 1}
		>
			<SegmentedChoice
				label="Viewport"
				options={viewports.map(sized)}
				bind:value={
					() => sized(viewport),
					(value) => (viewport = viewports.find((key) => sized(key) === value) ?? viewport)
				}
			/>
			<SegmentedChoice label="Image state" bind:value={imageState} options={states} />
		</hx-div>
		<hx-div class:before-after={before || mockup}>
			{#if before || mockup}<PriorImage
					{workspace}
					entityId={entity.id}
					version={before?.version ?? version}
					sha256={before?.sha256 ?? ''}
					title={`${entity.title} ${mockup ? 'current' : before?.version} ${sized(viewport)} ${selected.state}`}
					caption={mockup ? 'Before · Current mockup' : ''}
					note={unbuilt}
				/>{/if}{#if url}<AnnotatedImage
					src={url}
					title={`${entity.title} ${version}${caption} ${sized(viewport)} ${selected.state}`}
					caption={mockup ? `After · Planned ${version}` : before ? `After · ${version}` : ''}
					{threads}
					writable={annotatable}
					{comment}
					select={onthread}
				/>{:else}<EmptyState as="p" className="empty design-panel-empty"
					>{error || 'Loading design image…'}</EmptyState
				>{/if}
		</hx-div>{:else if current}<hx-article class="behavior-notes">
			<hx-h3>Planned behavior</hx-h3>
			<hx-p>{current.notes || 'No behavior notes recorded for this version.'}</hx-p>
			{#if headless}<hx-p class="muted">{proposed}{current.images.length ? earlier : ''}</hx-p>{/if}
		</hx-article>{:else}<EmptyState as="div" className="empty design-panel-empty">
			<hx-h3>{headless ? 'No plan yet' : 'No design image yet'}</hx-h3>
			<hx-p>{workspace.capabilities.planning ? empty.planning : empty.committed}</hx-p>
		</EmptyState>{/if}
	{#if error && url}<hx-p class="error" role="alert">{error}</hx-p>{/if}
	{#if entity.category === 'pages' && !inline}<hx-div class="row measures">
			<hx-span>Size · {entity.size.text || 'Not measured'}</hx-span><hx-span
				>Performance · {entity.performance.text || 'Not measured'}</hx-span
			>
		</hx-div>{/if}
</hx-section>
