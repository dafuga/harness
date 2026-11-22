/* global HH */
// Agents modal: every bot grouped by what it needs from you, and a chat pane beside the list.
// On a phone the list and the chat are two steps of one sheet (screen=agent-chat is step two).
HH.modals.agentGroups = [
	['needs-you', 'Needs you'],
	['working', 'Working'],
	['idle', 'Idle'],
	['offline', 'Offline']
];

HH.modals.agentList = function (agents) {
	return HH.modals.agentGroups
		.map(([state, label]) => {
			const group = agents.filter((a) => a.state === state);
			if (!group.length) return '';
			const rows = group
				.map((a, i) => HH.modals.agentItem(a, i === 0 && state === 'needs-you'))
				.join('');
			return `<section class="hh-group"><h3 class="po-band-title">${label} <span class="po-band-count">${group.length}</span></h3><ul class="po-items">${rows}</ul></section>`;
		})
		.join('');
};

HH.modals.agentItem = function (a, selected) {
	return `<li class="po-item hh-agent-row"${selected ? ' aria-current="true"' : ''}><div class="hh-agent">${HH.ui.avatar(a)}
		<span class="po-item-text"><span class="po-item-title">${a.name}</span><span class="po-item-meta">${HH.ui.esc(a.task)}</span>
		<span class="po-item-meta hh-agent-where">${a.machine} · ${a.model} · ${a.since}</span></span>
		<span class="hh-agent-side">${HH.ui.agentPill(a.state)}</span></div></li>`;
};

HH.modals.chat = function (agent) {
	const msgs = [
		['them', 'Morning brief is out. One thing needs you before 09:00.', '22:04'],
		[
			'them',
			'Grok Bot finished the staging call tests: 6 of 6 passed. Approve the Nudge production window for Sat 09:00? Rollback is the previous deploy.',
			'22:26'
		],
		['me', 'What changed since the last production deploy?', '22:27'],
		[
			'them',
			'Two commits: carrier-busy retry and a copy fix. Both have passing tests and staging call recordings.',
			'22:28'
		]
	]
		.map(
			([who, text, at]) =>
				`<li class="hh-msg" data-from="${who}"><p>${HH.ui.esc(text)}</p><span class="hh-msg-at">${at}</span></li>`
		)
		.join('');
	const actions =
		'<div class="hh-quick"><button type="button" class="po-action hh-primary">Approve Sat 09:00</button><button type="button" class="po-action">Not yet</button></div>';
	return `<section class="hh-chat" aria-label="Chat with ${agent.name}"><header class="hh-chat-head">${HH.ui.avatar(agent)}
		<div><h3 class="po-name">${agent.name}</h3><p class="po-sessions">${agent.machine} · ${agent.model}</p></div>${HH.ui.agentPill(agent.state)}</header>
		<ol class="hh-thread">${msgs}</ol>${actions}${HH.root.composer(agent.name)}</section>`;
};

HH.modals.agents = function (data, options) {
	const agents = data ? data.agents : [];
	const working = agents.filter((a) => a.state === 'working').length;
	const summary = data
		? agents.length
			? `${working} working · ${agents.length} agents on ${data.machines.length} computers`
			: 'No agents yet'
		: 'Loading agents…';
	let body;
	if (!data || !agents.length)
		body = HH.modals.state(
			data,
			6,
			'No agents are connected. Start a Claude or Codex session on any computer with the tracker and it appears here.',
			'How to connect'
		);
	else
		body = `<div class="hh-split hh-split-agents${options.chat ? ' hh-show-detail' : ''}"><div class="hh-split-list">${HH.modals.agentList(agents)}</div>${HH.modals.chat(agents[0])}</div>`;
	return HH.modals.shell({
		id: 'agents',
		title: options.chat && data ? agents[0].name : 'Agents',
		summary:
			options.chat && data ? 'Chat · replies reach the session on its own computer' : summary,
		back: options.chat,
		body
	});
};
