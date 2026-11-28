// Top bar, stats strip and filter row.
import { computers, projects, quota } from '../data.mjs';
import { av, brandMark, meter, mk, searchIcon } from './bits.mjs';

const pages = ['Home', 'Projects', 'Scheduled', 'Designs'];

export const topbar = (current = 'Home') => `
<header class="topbar">
	<span class="brand">${brandMark}Harness</span>
	<nav class="nav">${pages
		.map((page) => `<span${page === current ? ' aria-current="page"' : ''}>${page}</span>`)
		.join('')}</nav>
	<span class="account">${av('O')}<span>Owner</span></span>
</header>`;

const computer = (c) => `
<div class="unit" data-tone="${c.tone}">
	<div class="unit-head"><span class="tone">${mk(c.mark)}</span><span class="clip1">${c.name}</span><span class="state">${c.state}</span></div>
	${meter(c.load, c.tone === 'done' ? 'active' : c.tone)}
	<span class="unit-sub">${c.sub}</span>
</div>`;

const quotaUnit = (q) => `
<div class="unit">
	<div class="unit-head"><span>${q.name}</span><span class="muted" style="font-weight: 400">${q.window}</span></div>
	${meter(q.left, 'active')}
	<span class="unit-sub"><span class="num">${q.left}%</span> left · ${q.resets}</span>
</div>`;

export const stats = () => `
<section class="stats" aria-label="Overview">
	<button type="button" class="stat">
		<span class="kicker">Sessions running</span>
		<span class="stat-num num">7</span>
		<span class="stat-sub">4 Claude · 3 Codex</span>
	</button>
	<button type="button" class="stat needs">
		<span class="kicker">Needs you</span>
		<span class="stat-num num">3</span>
		<span class="stat-sub">Oldest waiting 2h 14m</span>
	</button>
	<div class="stat">
		<span class="kicker">Computers</span>
		<div class="stat-cols">${computers.map(computer).join('')}</div>
	</div>
	<div class="stat">
		<span class="kicker">Quota</span>
		<div class="stat-cols two">${quota.map(quotaUnit).join('')}</div>
	</div>
</section>`;

export const chips = (list = projects) =>
	list
		.map(
			(p) =>
				`<button type="button" class="chip" aria-pressed="${Boolean(p.pressed)}">${p.name}<span class="num">${p.open}</span></button>`
		)
		.join('');

export const toolbar = () => `
<div class="toolbar">
	${chips()}
	<span class="spacer"></span>
	<div class="search" role="search">${searchIcon}Search tasks</div>
	<button type="button" class="btn primary">New task</button>
</div>`;

export const statusline = () => `<p class="statusline">${mk()}Live · updated 12 seconds ago</p>`;
