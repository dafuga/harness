/* global HH */
// Root page, continued: the Plans, Scheduled, Projects and Work in progress previews.
HH.root.plans = function (data) {
	const n = HH.root.preview.plans;
	if (!data)
		return HH.root.section({
			id: 'plans',
			title: 'Plans',
			summary: 'Loading plans…',
			body: HH.ui.skeleton(n),
			total: 0
		});
	const open = data.plans.filter((p) => p.status !== 'done');
	const rows = open
		.slice(0, n)
		.map((p, i) =>
			HH.ui.row(
				p.title,
				`${p.project} · ${HH.modals.planLabel(p.status)} · updated ${p.updated}`,
				HH.root.progress(p),
				i >= 2
			)
		)
		.join('');
	const body = data.plans.length
		? `<ul class="po-items">${rows}</ul>`
		: HH.ui.empty(
				'No plans yet. Ask an agent to plan something and it is kept here.',
				'Start a plan'
			);
	return HH.root.section({
		id: 'plans',
		title: 'Plans',
		summary: data.plans.length
			? `${open.length} open · ${data.plans.length - open.length} done`
			: 'No plans yet',
		body,
		total: data.plans.length,
		seeAll: `All ${data.plans.length} plans`
	});
};

HH.root.progress = function (p) {
	return `<span class="hh-progress" aria-label="${p.done} of ${p.steps} steps"><span class="hh-progress-bar"><span style="width:${Math.round((p.done / p.steps) * 100)}%"></span></span><span class="hh-progress-text">${p.done}/${p.steps}</span></span>`;
};

HH.root.scheduled = function (data) {
	const n = HH.root.preview.scheduled;
	if (!data)
		return HH.root.section({
			id: 'scheduled',
			title: 'Scheduled',
			summary: 'Loading schedule…',
			body: HH.ui.skeleton(n),
			total: 0
		});
	const rows = data.scheduled
		.slice(0, n)
		.map((s, i) => HH.root.runRow(s, i >= 2))
		.join('');
	const body = data.scheduled.length
		? `<ul class="po-items hh-runs">${rows}</ul>`
		: HH.ui.empty(
				'Nothing is scheduled. Routines and one-off runs appear here in time order.',
				'Schedule a task'
			);
	const next = data.scheduled[0];
	return HH.root.section({
		id: 'scheduled',
		title: 'Scheduled',
		summary: next ? `Next: ${next.day.toLowerCase()} ${next.time}` : 'Nothing scheduled',
		body,
		total: data.scheduled.length,
		seeAll: `All ${data.scheduled.length} runs`
	});
};

HH.root.runRow = function (s, extra) {
	const meta = `${s.repeat} · ${s.agent}${s.paused ? ' · paused' : ''}`;
	return `<li class="po-item hh-run"${extra ? ' data-extra' : ''}${s.paused ? ' data-paused' : ''}><button type="button" class="po-item-open"><span class="hh-when"><span class="hh-when-day">${s.day}</span><span class="hh-when-time">${s.time}</span></span>
		<span class="po-item-text"><span class="po-item-title">${HH.ui.esc(s.title)}</span><span class="po-item-meta">${meta}</span></span></button></li>`;
};

HH.root.projects = function (data) {
	const n = HH.root.preview.projects;
	if (!data)
		return HH.root.section({
			id: 'projects',
			title: 'Projects',
			summary: 'Loading projects…',
			body: HH.ui.skeleton(n),
			total: 0
		});
	const row = (p, i) =>
		HH.ui.row(
			p.name,
			HH.root.counts(p),
			`<span class="hh-change"><code>${p.hash}</code> ${p.when}</span>`,
			i >= 2
		);
	// Rows past the preview are drawn for the wide two-column card only.
	const rows = data.projects
		.slice(0, n * 2)
		.map((p, i) =>
			i < n ? row(p, i) : row(p, i).replace('<li class="po-item"', '<li class="po-item" data-wide')
		)
		.join('');
	const body = data.projects.length
		? `<ul class="po-items">${rows}</ul>`
		: HH.ui.empty(
				'No projects yet. Add a repository to see its apps, pages and components.',
				'Add a project'
			);
	return HH.root.section({
		id: 'projects',
		title: 'Projects',
		summary: data.projects.length
			? `Last change: ${data.projects[0].name}, ${data.projects[0].when} ago`
			: 'No projects yet',
		body,
		total: data.projects.length,
		seeAll: `All ${data.projects.length} projects`
	});
};

HH.root.counts = function (p) {
	return [
		HH.ui.count(p.apps, 'app', 'apps'),
		HH.ui.count(p.pages, 'page', 'pages'),
		HH.ui.count(p.components, 'component', 'components')
	].join(' · ');
};

HH.root.wip = function (data) {
	const n = HH.root.preview.wip;
	if (!data)
		return HH.root.section({
			id: 'wip',
			title: 'Work in progress',
			summary: 'Loading work…',
			body: HH.ui.skeleton(n),
			total: 0
		});
	const rows = data.wip
		.slice(0, n)
		.map((w, i) =>
			HH.ui.row(
				w.title,
				`${w.project} · ${w.agent} · ${w.status}`,
				HH.ui.eta(w.eta, w.tone),
				i >= 2
			)
		)
		.join('');
	const body = data.wip.length
		? `<p class="hh-wip-line">${HH.root.wipLine(data)}</p><ul class="po-items">${rows}</ul>`
		: HH.ui.empty(
				'No work in progress. Tasks agents pick up appear here, soonest to finish first.'
			);
	return HH.root.section({
		id: 'wip',
		title: 'Work in progress',
		summary: data.wip.length ? 'Soonest to finish first' : 'All clear',
		body,
		total: data.wip.length,
		seeAll: 'All work'
	});
};

HH.root.wipLine = function (data) {
	const projects = new Set(data.wip.map((w) => w.project)).size;
	return `${HH.ui.count(data.wip.length, 'task', 'tasks')} across ${HH.ui.count(projects, 'project', 'projects')}`;
};

HH.root.render = function (data) {
	const sections = ['agents', 'plans', 'scheduled', 'projects', 'wip']
		.map((id) => HH.root[id](data))
		.join('');
	return `${HH.root.topbar()}<main class="po-page hh-page">${HH.root.head(data)}<div class="hh-grid">${sections}</div></main>`;
};
