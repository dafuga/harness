/* global HH */
// Projects modal: today's Harness app in one place. A project list on the left; the selected
// project's apps, pages, components and change history on the right (stacked on phones).
HH.modals.harnessDetail = {
	apps: [
		['Hub', 'Web · hosted', 21, 74],
		['Desktop', 'macOS · Electron', 18, 96],
		['iOS', 'Capacitor', 9, 42]
	],
	pages: ['Home', 'Projects', 'Project overview', 'Members', 'Invitations', 'Downloads'],
	components: [
		'ProjectOverviewCard',
		'StatusBadge',
		'Modal',
		'NavBar',
		'LoginPanel',
		'AccountMenu',
		'DetailList',
		'Pill'
	],
	history: [
		['dab8313', 'fix: pin the generated Rust project test toolchain', 'Harness builder', '1h'],
		[
			'8d3eb10',
			'fix: let loop CLI fixtures finish under resource admission',
			'Codex reviewer',
			'3h'
		],
		[
			'8a6b0e4',
			'Persist native Tracker claims and supervise isolated workers (#160)',
			'Harness builder',
			'6h'
		],
		['caea833', 'feat: show the Tracker project overview across Harness', 'Harness builder', 'Sat']
	]
};

HH.modals.projectDetail = function (p) {
	const d = HH.modals.harnessDetail;
	const apps = d.apps
		.map(
			([name, kind, pages, comps]) =>
				`<li class="hh-app"><h4 class="hh-app-name">${name}</h4><p class="po-item-meta">${kind}</p><p class="hh-app-counts">${pages} pages · ${comps} components</p></li>`
		)
		.join('');
	const pages = d.pages.map((x) => `<li class="hh-tag">${x}</li>`).join('');
	const comps = d.components.map((x) => `<li class="hh-tag hh-tag-code">${x}</li>`).join('');
	const history = d.history
		.map(
			([hash, msg, who, when]) =>
				`<li class="hh-commit"><code>${hash}</code><span class="po-item-title">${HH.ui.esc(msg)}</span><span class="po-item-meta">${who} · ${when}</span></li>`
		)
		.join('');
	return `<section class="hh-project-detail" aria-label="${p.name}"><div class="hh-detail-head"><h3 class="po-name">${p.name}</h3>
		<p class="po-sessions">${HH.root.counts(p)}</p></div>
		<h4 class="po-label">Apps</h4><ul class="hh-apps">${apps}</ul>
		<h4 class="po-label">Pages <span class="po-band-count">${p.pages}</span></h4><ul class="hh-tags">${pages}<li class="hh-tag hh-tag-more">+${p.pages - d.pages.length} more</li></ul>
		<h4 class="po-label">Components <span class="po-band-count">${p.components}</span></h4><ul class="hh-tags">${comps}<li class="hh-tag hh-tag-more">+${p.components - d.components.length} more</li></ul>
		<h4 class="po-label">Change history</h4><ol class="hh-history">${history}</ol></section>`;
};

HH.modals.projectItem = function (p, i) {
	return `<li class="po-item"${i === 0 ? ' aria-current="true"' : ''}><button type="button" class="po-item-open"><span class="po-item-text"><span class="po-item-title">${p.name}</span>
		<span class="po-item-meta">${HH.root.counts(p)}</span></span><span class="hh-change"><code>${p.hash}</code> ${p.when}</span></button></li>`;
};

HH.modals.projects = function (data) {
	const list = data ? data.projects : [];
	const body = list.length
		? `<div class="hh-split hh-split-projects"><div class="hh-split-list"><ul class="po-items">${list.map(HH.modals.projectItem).join('')}</ul></div>${HH.modals.projectDetail(list[0])}</div>`
		: HH.modals.state(
				data,
				6,
				'No projects yet. Add a repository to see its apps, pages, components and change history.',
				'Add a project'
			);
	return HH.modals.shell({
		id: 'projects',
		title: 'Projects',
		summary: !data
			? 'Loading projects…'
			: !list.length
				? 'No projects yet'
				: `${list.length} projects · ${list.reduce((n, p) => n + p.apps, 0)} apps`,
		body
	});
};
