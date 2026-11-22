/* global HH */
// Plans modal: filter chips by status, then a card per plan with its progress and next step.
HH.modals.planSteps = {
	'Hub home redesign': ['Agree the five sections', 'Mockups at four widths', 'Design review'],
	'Tracker hub failover': ['Standby hub on the box', 'Queue replay test', 'Promote drill'],
	'Signed desktop releases': ['Apple notarisation', 'Update feed', 'Release checklist'],
	'Nudge billing v2': ['Price table', 'Stripe test mode', 'Sign-up checks'],
	'iOS pairing polish': ['QR pairing', 'Retry on hub restart', 'Paired acceptance']
};
HH.modals.genericSteps = ['Scope and acceptance', 'First working slice', 'Review and ship'];

HH.modals.planCard = function (p) {
	const tone = {
		draft: 'quiet',
		review: 'needs-you',
		approved: 'active',
		active: 'active',
		done: 'done'
	}[p.status];
	const steps = (HH.modals.planSteps[p.title] || HH.modals.genericSteps)
		.map(
			(s, i) =>
				`<li class="hh-step" data-done="${i < Math.round((p.done / p.steps) * 3)}">${HH.ui.esc(s)}</li>`
		)
		.join('');
	return `<article class="po-card po-${tone} hh-plan"><div class="po-card-head"><div class="po-card-title"><h3 class="po-name">${HH.ui.esc(p.title)}</h3>
		<p class="po-sessions">${p.project} · updated ${p.updated}</p></div>${HH.ui.pill(tone, HH.modals.planLabel(p.status))}</div>
		${HH.root.progress(p)}<ol class="hh-steps">${steps}</ol>
		<div class="po-callout-actions"><button type="button" class="po-action">Open plan</button><button type="button" class="po-action">Discuss</button></div></article>`;
};

HH.modals.plans = function (data) {
	const plans = data ? data.plans : [];
	const by = (s) => plans.filter((p) => p.status === s).length;
	const chips = HH.ui.chips(
		[
			['All', plans.length],
			['Draft', by('draft')],
			['In review', by('review')],
			['Approved', by('approved')],
			['In progress', by('active')],
			['Done', by('done')]
		],
		0
	);
	const body = plans.length
		? `${chips}<div class="po-grid hh-plan-grid">${plans.map(HH.modals.planCard).join('')}</div>`
		: HH.modals.state(
				data,
				5,
				'No plans yet. Ask any agent to plan a change; the plan, its steps and its review are kept here.',
				'Start a plan'
			);
	const open = plans.filter((p) => p.status !== 'done').length;
	return HH.modals.shell({
		id: 'plans',
		title: 'Plans',
		summary: !data
			? 'Loading plans…'
			: plans.length
				? `${open} open · ${plans.length - open} done`
				: 'No plans yet',
		tools: data ? '<button type="button" class="po-action hh-primary">New plan</button>' : '',
		body
	});
};
