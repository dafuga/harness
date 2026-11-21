/* global HH */
// Quota section: usage left per subscription as meters ("% left", reset time). A limit under 25%
// left is Low and under 10% is Almost out; both carry a mark and a word, never colour alone.
HH.quota.level = function (left) {
	if (left < 10) return 'critical';
	return left < 25 ? 'low' : 'ok';
};

HH.quota.flag = function (level) {
	if (level === 'ok') return '';
	const word = level === 'critical' ? 'Almost out' : 'Low';
	return `<span class="hh-q-flag" data-level="${level}"><span class="hh-q-mark" aria-hidden="true"></span>${word}</span>`;
};

/** One limit: label and "% left" on a line, a bar of what is left, then the reset time. */
HH.quota.meter = function (limit, detail) {
	const level = HH.quota.level(limit.left);
	const when = detail ? `${limit.reset} · ${limit.note}` : limit.reset;
	return `<li class="hh-q-meter" data-level="${level}"><div class="hh-q-line"><span class="hh-q-label">${limit.label}</span>
		${HH.quota.flag(level)}<span class="hh-q-value"><strong>${limit.left}%</strong> left</span></div>
		<span class="hh-q-bar" role="meter" aria-valuenow="${limit.left}" aria-valuemin="0" aria-valuemax="100" aria-label="${limit.label} left"><span style="width:${limit.left}%"></span></span>
		<span class="hh-q-reset">${when}</span></li>`;
};

HH.quota.credits = function (sub) {
	if (!sub.credits) return '';
	const level = sub.credits.low ? 'low' : 'ok';
	return `<li class="hh-q-credits" data-level="${level}"><span class="hh-q-label">Credits</span>${HH.quota.flag(level)}
		<span class="hh-q-value"><strong>${sub.credits.left}</strong></span><span class="hh-q-reset">${sub.credits.note}</span></li>`;
};

HH.quota.lows = function (subs) {
	const lows = [];
	for (const sub of subs) {
		for (const limit of sub.limits) {
			if (limit.left < 25) lows.push({ sub, limit, level: HH.quota.level(limit.left) });
		}
	}
	return lows.sort((a, b) => a.limit.left - b.limit.left);
};

HH.quota.subHead = function (sub) {
	const stale = sub.stale ? ' data-stale' : '';
	return `<div class="hh-q-sub-head"${stale}><span class="hh-q-provider">${sub.provider}</span>
		<span class="po-item-meta">${sub.plan} · ${sub.account} · ${sub.read}</span></div>`;
};

/** The warning shown when the tightest limit is almost out: what, how much, and when it resets. */
HH.quota.callout = function (low) {
	const kind = low.level === 'critical' ? 'blocked' : 'attention';
	return `<div class="po-callout hh-q-callout" data-kind="${kind}" data-level="${low.level}"><div class="po-callout-head">
		<span class="po-callout-label">${low.level === 'critical' ? 'Almost out' : 'Running low'}</span><span class="po-callout-meta">${low.limit.reset}</span></div>
		<p class="po-callout-text">${low.sub.provider} ${low.limit.label.toLowerCase()}: ${low.limit.left}% left. Agents on it pause until the reset.</p></div>`;
};

HH.root.quota = function (data) {
	if (!data)
		return HH.root.section({
			id: 'quota',
			title: 'Quota',
			summary: 'Reading usage…',
			body: HH.ui.skeleton(4),
			total: 0
		});
	const subs = data.quota;
	if (!subs.length) {
		const body = HH.ui.empty(
			'No subscriptions connected. Connect Claude Code or Codex to see how much usage is left.',
			'Connect a subscription'
		);
		return HH.root.section({
			id: 'quota',
			title: 'Quota',
			summary: 'No subscriptions yet',
			body,
			total: 0
		});
	}
	const lows = HH.quota.lows(subs);
	const critical = lows.filter((l) => l.level === 'critical');
	const shown = subs.slice(0, 2);
	const blocks = shown
		.map(
			(sub) =>
				`<div class="hh-q-sub">${HH.quota.subHead(sub)}<ul class="hh-q-meters">${sub.limits.map((l) => HH.quota.meter(l)).join('')}${HH.quota.credits(sub)}</ul></div>`
		)
		.join('');
	const more =
		subs.length > shown.length
			? `<p class="po-more">${HH.ui.count(subs.length - shown.length, 'more subscription', 'more subscriptions')}</p>`
			: '';
	const tone = critical.length ? 'blocked' : 'needs-you';
	const pill = lows.length
		? `<span class="hh-tone hh-q-tone po-${tone}">${HH.ui.pill(tone, `${lows.length} running low`)}</span>`
		: '';
	return HH.root.section({
		id: 'quota',
		title: 'Quota',
		summary: lows.length
			? `Tightest: ${lows[0].sub.provider} ${lows[0].limit.label.toLowerCase()}, ${lows[0].limit.left}% left`
			: 'Plenty left on every subscription',
		pill,
		body: `${critical.length ? HH.quota.callout(critical[0]) : ''}${blocks}${more}`,
		total: subs.length,
		seeAll: `All ${HH.ui.count(subs.length, 'subscription', 'subscriptions')}`
	});
};
