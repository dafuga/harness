/* global HH */
// Work in progress modal. Default tab: every task, soonest to finish first. "By project" is the
// current Project Overview (n79x63 cards, bands and chips) moved here unchanged.
HH.modals.tabs = function (active) {
	const tab = (label, on) =>
		`<button type="button" role="tab" class="hh-tab" aria-selected="${on}">${label}</button>`;
	return `<div class="hh-tabs" role="tablist">${tab('Soonest first', active === 0)}${tab('By project', active === 1)}</div>`;
};

HH.modals.soonest = function (wip) {
	const rows = wip
		.map((w) =>
			HH.ui.row(w.title, `${w.project} · ${w.agent} · ${w.status}`, HH.ui.eta(w.eta, w.tone))
		)
		.join('');
	return `<ul class="po-items hh-soonest">${rows}</ul>`;
};

HH.modals.projectCards = function (wip) {
	const names = [...new Set(wip.map((w) => w.project))];
	return names.map((name) => {
		const items = wip.filter((w) => w.project === name);
		const state = items.some((w) => w.status === 'Needs you')
			? 'needs-you'
			: items.some((w) => w.status === 'Blocked')
				? 'blocked'
				: 'active';
		return { name, items, state, agents: new Set(items.map((w) => w.agent)).size };
	});
};

HH.modals.overviewCard = function (card) {
	const label = { 'needs-you': 'Needs you', blocked: 'Blocked', active: 'Active' }[card.state];
	const ask = card.items.find((w) => w.status !== 'In progress');
	const callout = ask
		? `<div class="po-callout" data-kind="${card.state === 'blocked' ? 'blocked' : 'attention'}"><div class="po-callout-head"><span class="po-callout-label">${label}</span>
		<span class="po-callout-meta">updated 20m ago</span></div><p class="po-callout-text">${HH.ui.esc(ask.title)}</p>
		<div class="po-callout-actions"><button type="button" class="po-action">Open item</button></div></div>`
		: '';
	const rows = card.items.filter((w) => w.status === 'In progress').slice(0, 3);
	const list = rows
		.map((w, i) =>
			HH.ui.row(w.title, `In progress · Live · updated 12m ago`, HH.ui.eta(w.eta, w.tone), i > 0)
		)
		.join('');
	const more = card.items.length - rows.length - (ask ? 1 : 0);
	return `<article class="po-card po-${card.state}"><div class="po-card-head"><div class="po-card-title"><h3 class="po-name">${card.name}</h3>
		<div class="po-sessions"><span class="po-live-dot" aria-hidden="true"></span><span>${HH.ui.count(card.agents, 'live session', 'live sessions')}</span></div></div>
		${HH.ui.pill(card.state, label)}</div>${callout}
		${rows.length ? `<div class="po-work"><h4 class="po-label">In progress</h4><ul class="po-items">${list}</ul>${more > 0 ? `<p class="po-more">${more} more in progress</p>` : ''}</div>` : ''}
		<div class="po-milestone"><div class="po-milestone-head"><span class="po-label">Last milestone</span><span class="po-milestone-at">21 Nov</span></div>
		<p class="po-milestone-text">Tests green on the last change; evidence recorded on the tracker.</p></div></article>`;
};

HH.modals.byProject = function (wip) {
	const cards = HH.modals.projectCards(wip);
	const band = (label, states) => {
		const inBand = cards.filter((c) => states.includes(c.state));
		if (!inBand.length) return '';
		return `<section class="po-band"><h3 class="po-band-title">${label} <span class="po-band-count">${inBand.length}</span></h3>
			<div class="po-grid">${inBand.map(HH.modals.overviewCard).join('')}</div></section>`;
	};
	const chips = HH.ui.chips(
		[
			['All', cards.length],
			['Needs you', cards.filter((c) => c.state === 'needs-you').length],
			['Blocked', cards.filter((c) => c.state === 'blocked').length],
			['Active', cards.filter((c) => c.state === 'active').length]
		],
		0
	);
	return `<div class="hh-overview">${chips}${band('Needs attention', ['needs-you', 'blocked'])}${band('Active', ['active'])}</div>`;
};

HH.modals.wip = function (data, options) {
	const wip = data ? data.wip : [];
	let body = HH.modals.state(
		data,
		8,
		'No work in progress. When an agent starts a tracked task it appears here, soonest to finish first.'
	);
	if (wip.length)
		body = `${HH.modals.tabs(options.byProject ? 1 : 0)}${options.byProject ? HH.modals.byProject(wip) : HH.modals.soonest(wip)}`;
	return HH.modals.shell({
		id: options.byProject ? 'wip-projects' : 'wip',
		title: 'Work in progress',
		summary: data ? (wip.length ? HH.root.wipLine(data) : 'All clear') : 'Loading work…',
		body
	});
};
