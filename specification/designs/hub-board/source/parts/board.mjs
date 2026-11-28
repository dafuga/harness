// Board columns and cards. Cards are summaries: no inputs, at most one small action.
import { columns } from '../data.mjs';
import { mk, pill, tag } from './bits.mjs';

const top = (c, right) =>
	`<span class="card-top"><span class="project">${c.project}</span>${right}</span>`;
const when = (c) => (c.when ? `<span class="when num">${c.when}</span>` : '');
const title = (c) => `<span class="card-title clip2">${c.title}</span>`;
const tags = (c) => (c.tags ?? []).map(tag).join('');

const bodies = {
	todo: (c) =>
		`${top(c, when(c))}${title(c)}<span class="card-foot">${tags(c)}${c.note ? `<span class="muted">${c.note}</span>` : ''}</span>`,
	active: (c) => `${top(c, when(c))}${title(c)}<span class="card-foot">${tags(c)}</span>`,
	needs: (c) =>
		`${top(c, `<span class="sep num">${c.when}</span><span class="when">${pill('needs', 'Needs you')}</span>`)}${title(c)}
		<span class="card-line"><span class="clip1 grow">${c.line}</span><span class="btn sm">Answer</span></span>`,
	blocked: (c) =>
		`${top(c, when(c))}${title(c)}<span class="card-line" data-tone="blocked">${mk('blocked')}<span class="clip1">${c.line}</span></span>`,
	done: (c) =>
		`${top(c, when(c))}${title(c)}<span class="card-foot" data-tone="done"><span class="tone">${mk('done')}</span><span class="muted">Merged</span><span class="link">${c.pr}</span></span>`
};

export const card = (c, extra = '') =>
	`<li><button type="button" class="card ${c.kind}${extra}">${bodies[c.kind](c)}</button></li>`;

const headExtra = (col) =>
	col.needs ? `<span class="extra">${pill('needs', `${col.needs} need you`)}</span>` : '';

const countText = (col) => `${col.count}${col.note ? ` ${col.note}` : ''}`;

export const colHead = (col) => `
<h2 class="col-head" data-tone="${col.tone}">${mk(col.key)}${col.title}<span class="count num">${countText(col)}</span>${headExtra(col)}</h2>`;

export const column = (col, opts = {}) => {
	const cards = col.cards.slice(0, opts.limit ?? col.limit ?? col.cards.length);
	const selected = (c) => (opts.selected === c.title ? ' selected' : '');
	return `
<section class="col" aria-label="${col.title}">
	${colHead(col)}
	<ul class="cards">${cards.map((c) => card(c, selected(c))).join('')}</ul>
	${col.more ? `<button type="button" class="col-more">${col.more}</button>` : ''}
</section>`;
};

export const board = (opts = {}) =>
	`<div class="board">${columns.map((col) => column(col, opts)).join('')}</div>`;
