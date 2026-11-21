/* global HH */
// The root summary page: the Hub top bar, a one-line headline, then five section cards. Each card
// is a preview (a few rows) and a "See all" button that opens that section's modal.
HH.root = {};
HH.root.preview = { agents: 4, plans: 4, scheduled: 4, projects: 3, wip: 4 };

HH.root.topbar = function () {
	return `<header class="hh-topbar"><a class="hh-brand" href="#">${HH.ui.brand(22)} Harness</a>
		<span class="hh-crumb">Home</span>
		<span class="hh-account"><span class="hh-avatar hh-avatar-me" aria-hidden="true">D</span><span class="hh-account-name">Daniel</span></span></header>`;
};

HH.root.head = function (data) {
	if (!data) {
		return `<header class="po-head hh-head"><p class="po-kicker">Home</p><h1 class="po-title">Loading your home…</h1>
			<p class="po-totals" role="status">Reading agents, plans, schedules and projects</p></header>`;
	}
	const working = data.agents.filter((a) => a.state === 'working').length;
	const needs = data.agents.filter((a) => a.state === 'needs-you').length;
	const title =
		data.agents.length === 0
			? 'Nothing is running yet'
			: `${HH.ui.count(working, 'agent', 'agents')} working${needs ? `, ${needs} ${needs === 1 ? 'needs' : 'need'} you` : ''}`;
	const machines = data.machines
		.map(
			(m) =>
				`<li class="po-machine" data-state="${m.status}"><span class="po-machine-mark" aria-hidden="true"></span>${m.name} <span class="po-machine-status">${m.status}</span></li>`
		)
		.join('');
	return `<header class="po-head hh-head"><p class="po-kicker">Home</p><h1 class="po-title">${title}</h1>
		<p class="po-totals">${HH.root.totals(data)}</p><ul class="po-machines" aria-label="Computers">${machines}</ul></header>`;
};

HH.root.totals = function (data) {
	if (!data.wip.length && !data.scheduled.length)
		return 'No tasks, plans or scheduled runs yet. Your computers are connected.';
	const projects = new Set(data.wip.map((w) => w.project)).size;
	return `${HH.ui.count(data.wip.length, 'task', 'tasks')} in progress across ${HH.ui.count(projects, 'project', 'projects')} · ${HH.ui.count(data.scheduled.length, 'scheduled run', 'scheduled runs')}`;
};

/** One section card: heading with count, a summary line, the preview body, and See all. */
HH.root.section = function (spec) {
	const more =
		spec.total > 0
			? `<button type="button" class="po-action hh-see-all" data-open="${spec.id}">${spec.seeAll} ${HH.ui.icon('arrow')}</button>`
			: '';
	return `<section class="po-card hh-section hh-${spec.id}" aria-labelledby="hh-${spec.id}-title">
		<div class="po-card-head"><div class="po-card-title"><h2 id="hh-${spec.id}-title" class="po-name">${spec.title}</h2>
		<p class="po-sessions">${spec.summary}</p></div>${spec.pill || ''}</div>
		<div class="hh-section-body">${spec.body}</div>${spec.footer || ''}<div class="hh-section-foot">${more}</div></section>`;
};

HH.root.agents = function (data) {
	const n = HH.root.preview.agents;
	if (!data)
		return HH.root.section({
			id: 'agents',
			title: 'Agents',
			summary: 'Loading agents…',
			body: HH.ui.skeleton(n),
			total: 0
		});
	const list = data.agents;
	const working = list.filter((a) => a.state === 'working').length;
	const needs = list.filter((a) => a.state === 'needs-you').length;
	const rows = list
		.slice(0, n)
		.map((a, i) => HH.root.agentRow(a, i >= 2))
		.join('');
	const body = list.length
		? `<ul class="po-items hh-agent-list">${rows}</ul>`
		: HH.ui.empty(
				'No agents are connected. Start a session on any computer and it appears here.',
				'Connect a computer'
			);
	const composer = list.length ? HH.root.composer(list[0].name) : '';
	return HH.root.section({
		id: 'agents',
		title: 'Agents',
		summary: list.length
			? `${working} working · ${list.length - working - needs} idle or offline`
			: 'No agents yet',
		pill: needs
			? `<span class="hh-tone po-needs-you">${HH.ui.pill('needs-you', `${needs} needs you`)}</span>`
			: '',
		body,
		footer: composer,
		total: list.length,
		seeAll: `All ${list.length} agents`
	});
};

HH.root.agentRow = function (a, extra) {
	return `<li class="po-item hh-agent-row"${extra ? ' data-extra' : ''}><div class="hh-agent">${HH.ui.avatar(a)}
		<span class="po-item-text"><span class="po-item-title">${a.name}</span><span class="po-item-meta">${HH.ui.esc(a.task)}</span></span>
		<span class="hh-agent-side">${HH.ui.agentPill(a.state)}<button type="button" class="po-action hh-talk">Message</button></span></div></li>`;
};

HH.root.composer = function (name) {
	return `<form class="hh-composer" onsubmit="return false"><label class="hh-composer-to"><span class="hh-sr">To</span>
		<span class="hh-to-chip">${HH.ui.esc(name)} ▾</span></label>
		<input class="hh-composer-input" placeholder="Message ${HH.ui.esc(name)}…" aria-label="Message" />
		<button type="submit" class="hh-send" aria-label="Send">${HH.ui.icon('send')}</button></form>`;
};
