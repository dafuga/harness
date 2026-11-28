// iPhone-width pieces: compact stats, the column switch and the bottom agents bar.
import { asking } from '../data-agents.mjs';
import { columns, computers } from '../data.mjs';
import { av, brandMark, mk, pill } from './bits.mjs';
import { card } from './board.mjs';
import { chips } from './shell.mjs';

export const phoneTop = () => `
<header class="topbar"><span class="brand">${brandMark}Harness</span><span class="account">${av('O')}</span></header>`;

const cell = (num, label, cls = '') =>
	`<button type="button" class="pcell${cls}"><span class="pnum num">${num}</span><span class="plabel">${label}</span></button>`;

const comp = (c) => `
<span class="pcomp" data-tone="${c.tone}"><span class="tone">${mk(c.mark)}</span><span class="grow"><b class="clip1">${c.name}</b><span class="muted">${c.short}</span></span></span>`;

export const phoneStats = () => `
<section class="pstats" aria-label="Overview">
	<div class="pcells">${cell(7, 'Sessions')}${cell(3, 'Need you', ' needs')}${cell('64%', 'Claude left')}${cell('22%', 'Codex left')}</div>
	<div class="pcomputers">${computers.map(comp).join('')}</div>
</section>`;

export const phoneChips = () => `<div class="pchips">${chips()}</div>`;

const tab = (col, selected) => `
<button type="button" class="ptab" role="tab" aria-selected="${col.key === selected}"><b class="num">${col.count}${col.needs ? mk('needs') : ''}</b>${col.short}</button>`;

export const phoneTabs = (selected) =>
	`<div class="ptabs" role="tablist">${columns.map((col) => tab(col, selected)).join('')}</div>`;

export const phoneCards = (selected) => {
	const col = columns.find((c) => c.key === selected);
	return `<ul class="cards">${col.cards.map((c) => card(c)).join('')}</ul>`;
};

export const phoneDock = () => `
<div class="pdock"><button type="button" class="dock-bar" aria-label="Agents, 3 have questions">
	<span class="av-stack">${asking.map((a) => av(a.initials, 'needs')).join('')}</span>
	<span class="grow">Agents</span>
	${pill('needs', '3 have questions')}
	<span class="go" aria-hidden="true">&rsaquo;</span>
</button></div>`;
