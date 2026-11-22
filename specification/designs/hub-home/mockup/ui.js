/* global HH */
// Small markup helpers shared by the root page and every modal. Rows reuse the n79x63 overview
// item shape (.po-item, .po-eta) and its state pill (.po-state) so the home reads as one system.
HH.ui = {
	esc(text) {
		return String(text).replace(
			/[&<>"]/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
		);
	},
	count(n, one, many) {
		return `${n} ${n === 1 ? one : many}`;
	},
	/** The overview's state pill: needs-you diamond, active dot, blocked square, quiet dashed ring. */
	pill(state, label) {
		return `<span class="po-state" data-state="${state}"><span class="po-mark" aria-hidden="true"></span>${HH.ui.esc(label)}</span>`;
	},
	agentPill(state) {
		const map = {
			'needs-you': ['needs-you', 'Needs you'],
			working: ['active', 'Working'],
			idle: ['quiet', 'Idle'],
			offline: ['quiet', 'Offline']
		};
		const [tone, label] = map[state];
		return `<span class="hh-tone po-${tone}">${HH.ui.pill(tone, label)}</span>`;
	},
	eta(text, tone) {
		return `<span class="po-eta"${tone ? ` data-tone="${tone}"` : ''}>${HH.ui.esc(text)}</span>`;
	},
	/** One overview row: title, a muted meta line, and a trailing chip. */
	row(title, meta, trailing, extra) {
		return `<li class="po-item"${extra ? ' data-extra' : ''}><button type="button" class="po-item-open">
			<span class="po-item-text"><span class="po-item-title">${HH.ui.esc(title)}</span>
			<span class="po-item-meta">${HH.ui.esc(meta)}</span></span>${trailing || ''}</button></li>`;
	},
	initials(name) {
		return name
			.split(' ')
			.filter((part) => part !== 'of')
			.map((part) => part[0].toUpperCase())
			.join('')
			.slice(0, 2);
	},
	avatar(agent) {
		return `<span class="hh-avatar" data-state="${agent.state}" aria-hidden="true">${HH.ui.initials(agent.name)}</span>`;
	},
	brand(size) {
		const tiles = [
			[0, 0],
			[2, 0],
			[1, 1],
			[0, 2],
			[2, 2]
		]
			.map(([c, r]) => `<rect x="${c * 11}" y="${r * 11}" width="10" height="10"/>`)
			.join('');
		return `<svg class="hh-brand-mark" viewBox="0 0 32 32" width="${size}" height="${size}" fill="currentColor" aria-hidden="true">${tiles}</svg>`;
	},
	icon(name) {
		const paths = {
			close: 'M6 6l12 12M18 6L6 18',
			send: 'M4 12l16-8-6 16-2-7-8-1z',
			arrow: 'M5 12h14M13 6l6 6-6 6',
			back: 'M19 12H5M11 6l-6 6 6 6',
			repeat: 'M4 12a8 8 0 0114-5l2 2M20 12a8 8 0 01-14 5l-2-2M18 4v5h-5M6 20v-5h5',
			pause: 'M9 5v14M15 5v14'
		};
		return `<svg class="hh-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
	},
	chips(labels, pressed) {
		const buttons = labels
			.map(
				([label, n], i) =>
					`<button type="button" class="po-chip" aria-pressed="${i === pressed}">${HH.ui.esc(label)} <span class="po-chip-count">${n}</span></button>`
			)
			.join('');
		return `<div class="po-filters hh-filters" role="group">${buttons}</div>`;
	},
	/** Placeholder rows while a section loads: same height as real rows so nothing jumps. */
	skeleton(rows) {
		const line =
			'<li class="hh-skel-row"><span class="hh-skel hh-skel-title"></span><span class="hh-skel hh-skel-meta"></span></li>';
		return `<ul class="hh-skel-list" aria-hidden="true">${line.repeat(rows)}</ul>`;
	},
	empty(text, action) {
		const button = action
			? `<button type="button" class="po-action">${HH.ui.esc(action)}</button>`
			: '';
		return `<div class="po-empty hh-empty" role="status"><p>${HH.ui.esc(text)}</p>${button}</div>`;
	}
};

// The modal shell every "See all" opens: a dialog over the dimmed root page. Phones get a
// full-screen sheet with the same header; the body scrolls, the header and close stay put.
HH.modals = {
	shell(spec) {
		const back = spec.back
			? `<button type="button" class="hh-icon-button hh-back" aria-label="Back">${HH.ui.icon('back')}</button>`
			: '';
		return `<div class="hh-scrim"></div><div class="hh-dialog hh-dialog-${spec.id}" role="dialog" aria-modal="true" aria-labelledby="hh-dialog-title">
			<header class="hh-dialog-head">${back}<div class="hh-dialog-titles"><h2 id="hh-dialog-title" class="hh-dialog-title">${spec.title}</h2>
			<p class="po-totals">${spec.summary}</p></div>${spec.tools || ''}
			<button type="button" class="hh-icon-button" aria-label="Close">${HH.ui.icon('close')}</button></header>
			<div class="hh-dialog-body">${spec.body}</div></div>`;
	},
	planLabel(status) {
		return {
			draft: 'Draft',
			review: 'In review',
			approved: 'Approved',
			active: 'In progress',
			done: 'Done'
		}[status];
	},
	/** Loading and empty bodies for any modal, so each section's states match the root's. */
	state(data, rows, emptyText, action) {
		if (!data) return `<p class="hh-sr" role="status">Loading…</p>${HH.ui.skeleton(rows)}`;
		return HH.ui.empty(emptyText, action);
	}
};
