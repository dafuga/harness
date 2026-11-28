// The two alternative directions: agents in a sidebar, and one lane per project.
import { columns, computers, quota } from '../data.mjs';
import { mk, pill, searchIcon } from './bits.mjs';
import { card, colHead } from './board.mjs';
import { dockBody } from './dock.mjs';

const computerRow = (c) =>
	`<li class="side-row" data-tone="${c.tone}"><span class="tone">${mk(c.mark)}</span>${c.name}<span class="end num">${c.short}</span></li>`;
const quotaRow = (q) =>
	`<li class="side-row">${q.name} <span class="muted">${q.window}</span><span class="end num">${q.left}% left</span></li>`;

export const sidebar = () => `
<aside class="side" aria-label="Agents">
	<button type="button" class="btn wide">New conversation</button>
	${dockBody()}
	<div class="side-foot">
		<section><h3 class="kicker">Computers</h3><ul class="side-rows">${computers.map(computerRow).join('')}</ul></section>
		<section><h3 class="kicker">Quota</h3><ul class="side-rows">${quota.map(quotaRow).join('')}</ul></section>
	</div>
</aside>`;

export const sideHead = () => `
<div class="toolbar">
	<h1 class="headline">7 sessions running, 3 need you</h1>
	<span class="spacer"></span>
	<div class="search" role="search">${searchIcon}Search tasks</div>
	<button type="button" class="btn primary">New task</button>
</div>`;

export const tabbar = () => `
<nav class="tabbar" aria-label="Sections"><span aria-current="page">Board</span><span>Agents ${pill('needs', '3')}</span><span>Status</span></nav>`;

const lanes = [
	{ name: 'Harness', open: 8, needs: 1 },
	{ name: 'Notes app', open: 5, needs: 1 },
	{ name: 'Shop site', open: 4, needs: 1 }
];

const laneCards = (lane, col, limit = 3) =>
	col.cards
		.filter((c) => c.project === lane.name)
		.slice(0, limit)
		.map((c) => card(c, ' mini'))
		.join('');

const laneName = (lane) => `
<div class="lane-name"><b>${lane.name}</b><span class="muted" style="font-size: 13px">${lane.open} open</span>${pill('needs', `${lane.needs} needs you`)}</div>`;

const laneRow = (lane) => `
<section class="lane" aria-label="${lane.name}">
	${laneName(lane)}
	${columns.map((col) => `<ul class="cards">${laneCards(lane, col)}</ul>`).join('')}
</section>`;

export const laneBoard = () => `
<div class="lanes">
	<div class="lane-heads"><span></span>${columns.map(colHead).join('')}</div>
	${lanes.map(laneRow).join('')}
</div>`;

export const laneToolbar = () => `
<div class="toolbar">
	<span class="muted">3 projects · 17 open tasks</span>
	<span class="spacer"></span>
	<div class="search" role="search">${searchIcon}Search tasks</div>
	<button type="button" class="btn primary">New task</button>
</div>`;

const urgent = (lane) =>
	[columns[2], columns[1]]
		.flatMap((col) => col.cards.filter((c) => c.project === lane.name))
		.slice(0, 2);

const phoneLane = (lane) => `
<section class="plane" aria-label="${lane.name}">
	<h2 class="plane-head">${lane.name}<span class="muted">${lane.open} open</span>${pill('needs', `${lane.needs} needs you`)}</h2>
	<ul class="cards">${urgent(lane)
		.map((c) => card(c, ' mini'))
		.join('')}</ul>
	<button type="button" class="col-more">See all ${lane.open} in ${lane.name}</button>
</section>`;

export const phoneLanes = () => lanes.map(phoneLane).join('');
