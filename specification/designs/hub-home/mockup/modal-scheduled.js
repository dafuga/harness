/* global HH */
// Scheduled modal: a time-ordered agenda grouped by day. Each run names its agent and computer;
// repeating routines carry a repeat mark, paused runs are dimmed and say so.
HH.modals.runItem = function (s) {
	const kind = s.repeat === 'Once' ? 'One-off' : s.repeat;
	const mark = s.paused ? HH.ui.icon('pause') : s.repeat === 'Once' ? '' : HH.ui.icon('repeat');
	return `<li class="po-item hh-agenda-row"${s.paused ? ' data-paused' : ''}><button type="button" class="po-item-open">
		<span class="hh-agenda-time">${s.time}</span>
		<span class="po-item-text"><span class="po-item-title">${HH.ui.esc(s.title)}</span>
		<span class="po-item-meta">${s.agent} · ${s.machine}</span></span>
		<span class="hh-repeat">${mark}${s.paused ? 'Paused' : kind}</span></button></li>`;
};

HH.modals.scheduled = function (data) {
	const runs = data ? data.scheduled : [];
	const days = [...new Set(runs.map((s) => s.day))];
	const agenda = days
		.map((day) => {
			const rows = runs
				.filter((s) => s.day === day)
				.map(HH.modals.runItem)
				.join('');
			return `<section class="hh-group"><h3 class="po-band-title">${day}</h3><ul class="po-items">${rows}</ul></section>`;
		})
		.join('');
	const repeating = runs.filter((s) => s.repeat !== 'Once').length;
	const chips = HH.ui.chips(
		[
			['All', runs.length],
			['Routines', repeating],
			['One-off', runs.length - repeating],
			['Paused', runs.filter((s) => s.paused).length]
		],
		0
	);
	const body = runs.length
		? `${chips}<div class="hh-agenda">${agenda}</div>`
		: HH.modals.state(
				data,
				6,
				'Nothing is scheduled. Ask an agent to run something later or on a repeat; it is listed here in time order.',
				'Schedule a task'
			);
	return HH.modals.shell({
		id: 'scheduled',
		title: 'Scheduled tasks',
		summary: !data
			? 'Loading schedule…'
			: runs.length
				? `${runs.length} upcoming · ${repeating} routines`
				: 'Nothing scheduled',
		tools: data ? '<button type="button" class="po-action hh-primary">Schedule</button>' : '',
		body
	});
};
