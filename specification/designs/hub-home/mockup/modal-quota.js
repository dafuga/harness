/* global HH */
// Quota modal: one panel per subscription. Limits with reset countdowns, a 7-day history of the
// weekly limit used per day (one series: no legend, one axis, today labelled), and top agents.
HH.quota.chart = function (sub) {
	const width = 336;
	const height = 132;
	const plot = { top: 18, bottom: 112, left: 34 };
	const max = 20;
	const step = (width - plot.left) / sub.history.length;
	const y = (v) => plot.bottom - (Math.min(v, max) / max) * (plot.bottom - plot.top);
	const grid = [0, 10, 20]
		.map(
			(v) =>
				`<line class="hh-q-grid" x1="${plot.left}" x2="${width}" y1="${y(v)}" y2="${y(v)}"/><text class="hh-q-axis" x="${plot.left - 6}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`
		)
		.join('');
	const bars = sub.history
		.map((v, i) => {
			const x = plot.left + i * step + 6;
			const w = step - 12;
			const top = y(v);
			const today = i === sub.history.length - 1;
			const label = today
				? `<text class="hh-q-label-today" x="${x + w / 2}" y="${top - 5}" text-anchor="middle">${v}%</text>`
				: '';
			return `<g class="hh-q-col"><title>${HH.quota.days[i]}: ${v}% of the weekly limit</title>
				<rect class="hh-q-bar-mark" x="${x}" y="${top}" width="${w}" height="${plot.bottom - top}" rx="4"/>
				<rect class="hh-q-bar-mark" x="${x}" y="${Math.max(top, plot.bottom - 4)}" width="${w}" height="${Math.min(4, plot.bottom - top)}"/>
				<text class="hh-q-axis" x="${x + w / 2}" y="${height - 4}" text-anchor="middle">${today ? 'Today' : HH.quota.days[i]}</text>${label}</g>`;
		})
		.join('');
	return `<figure class="hh-q-chart"><figcaption class="po-label">Weekly limit used per day</figcaption>
		<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${sub.provider} usage per day, last 7 days">${grid}${bars}</svg></figure>`;
};

HH.quota.top = function (sub) {
	const rows = sub.top
		.map(
			([name, pct]) =>
				`<li class="hh-q-top-row"><span>${name}</span><span class="hh-q-top-value">${pct}% of this week</span></li>`
		)
		.join('');
	return `<div class="hh-q-top"><h4 class="po-label">Used most this week</h4><ul>${rows}</ul></div>`;
};

HH.quota.panel = function (sub) {
	const lows = HH.quota.lows([sub]);
	const worst = lows[0];
	const state = sub.stale
		? ['quiet', 'Not read']
		: worst
			? [
					worst.level === 'critical' ? 'blocked' : 'needs-you',
					worst.level === 'critical' ? 'Almost out' : 'Low'
				]
			: ['done', 'OK'];
	const stale = sub.stale
		? `<p class="po-note hh-q-stale">Usage was not read for 3h. Numbers may be out of date. <button type="button" class="po-action">Read now</button></p>`
		: '';
	return `<article class="po-card po-${state[0]} hh-q-panel"><div class="po-card-head"><div class="po-card-title"><h3 class="po-name">${sub.provider} <span class="hh-q-plan">${sub.plan}</span></h3>
		<p class="po-sessions">${sub.account} account · ${sub.read}</p></div>${HH.ui.pill(state[0], state[1])}</div>${stale}
		${worst && worst.level === 'critical' ? HH.quota.callout(worst) : ''}
		<div class="hh-q-panel-grid"><ul class="hh-q-meters">${sub.limits.map((l) => HH.quota.meter(l, true)).join('')}${HH.quota.credits(sub)}</ul>
		${HH.quota.chart(sub)}${HH.quota.top(sub)}</div>
		<div class="po-callout-actions"><button type="button" class="po-action">Warn me at 25% left ▾</button><button type="button" class="po-action">Open ${sub.provider} usage</button></div></article>`;
};

HH.quota.addTile = function () {
	return `<div class="po-empty hh-empty hh-q-add"><p><strong>Add a subscription</strong><br />Another Claude or OpenAI account, or a new provider when it is supported.</p>
		<button type="button" class="po-action">Connect</button></div>`;
};

HH.modals.quota = function (data) {
	const subs = data ? data.quota : [];
	const lows = data ? HH.quota.lows(subs) : [];
	let summary = 'Reading usage…';
	if (data)
		summary = subs.length
			? `${HH.ui.count(subs.length, 'subscription', 'subscriptions')} · ${lows.length ? `${lows.length} running low` : 'all OK'}`
			: 'No subscriptions yet';
	const body = subs.length
		? `<div class="hh-q-panels">${subs.map(HH.quota.panel).join('')}${HH.quota.addTile()}</div>`
		: HH.modals.state(
				data,
				6,
				'No subscriptions connected. Connect Claude Code or Codex and Harness reads how much usage is left, and when it resets.',
				'Connect a subscription'
			);
	return HH.modals.shell({ id: 'quota', title: 'Quota', summary, body });
};
