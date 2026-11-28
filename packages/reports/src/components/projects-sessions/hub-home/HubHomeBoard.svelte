<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_ycwbrdmain -->
<script lang="ts">
	import { tick } from 'svelte';
	import Modal from '$reports/components/Modal.svelte';
	import Select from '$reports/components/shared-primitives/Select.svelte';
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import type { LinkedHome } from '$reports/lib/projects-sessions/hub-home/homeLive.types';
	import type { HomeBoardCard } from '$reports/lib/projects-sessions/hub-home/homeTaskBoard.types';
	import { runTime } from './hubHomeTime';
	import {
		boardColumns,
		boardNotice,
		boardProjects,
		priorityLabels,
		shortItemId
	} from './hubHomeTaskBoard';
	import HubHomeBoardColumn from './HubHomeBoardColumn.svelte';
	import HubHomeJobDetail from './HubHomeJobDetail.svelte';

	let { reading, now, close }: { reading: LinkedHome | null; now: number; close: () => void } =
		$props();
	let project = $state('');
	let selected = $state.raw<HomeBoardCard>();
	let trigger: HTMLButtonElement | undefined;
	const notice = $derived(boardNotice(reading));
	const overview = $derived(notice ? undefined : reading?.snapshot?.liveOverview);
	const board = $derived(overview?.board);
	const projects = $derived(board ? boardProjects(board) : []);
	// A project that leaves the board stays chosen and shows empty columns, never every project.
	const choices = $derived(
		project && !projects.includes(project) ? [project, ...projects] : projects
	);
	const detail = $derived(
		selected && (board?.cards.find(({ row }) => row.itemId === selected?.row.itemId) ?? selected)
	);

	function openCard(card: HomeBoardCard, button: HTMLButtonElement) {
		trigger = button;
		selected = card;
	}

	function closeCard() {
		const button = trigger;
		selected = undefined;
		void tick().then(() => button?.focus());
	}
</script>

<Modal
	isOpen
	title="Board"
	summary={overview ? `Read only · Tracker as of ${runTime(overview.readAt)}` : 'Read only'}
	variant="section"
	onClose={close}
>
	{#if board}
		<hx-div class="hh-board">
			<hx-label class="hh-board-filter">
				<hx-span>Project</hx-span>
				<Select label="Project" bind:value={project}>
					<hx-option value="">All projects</hx-option>
					{#each choices as name (name)}<hx-option value={name}>{name}</hx-option>{/each}
				</Select>
			</hx-label>
			<hx-div class="hh-board-columns" role="group" aria-label="Board columns">
				{#each boardColumns(board, project) as column (column.id)}
					<HubHomeBoardColumn {column} {now} open={openCard} />
				{/each}
			</hx-div>
		</hx-div>
	{:else}
		<EmptyState as="div" className="po-empty hh-empty"><hx-p>{notice}</hx-p></EmptyState>
	{/if}
</Modal>

{#if detail}
	<HubHomeJobDetail
		row={detail.row}
		{now}
		state={detail.label}
		facts={[shortItemId(detail.row.itemId), detail.project, `${priorityLabels[detail.priority]} priority`]}
		reason={detail.reason}
		close={closeCard}
	/>
{/if}
