/* global HH, document, window */
// Reads ?screen and ?state, draws the root page, and opens the requested modal over it.
(function () {
	const params = new window.URLSearchParams(window.location.search);
	const screen = params.get('screen') || 'root';
	const state = params.get('state') || 'default';
	const data = HH.data[state];
	const modals = {
		agents: () => HH.modals.agents(data, {}),
		'agent-chat': () => HH.modals.agents(data, { chat: true }),
		quota: () => HH.modals.quota(data),
		plans: () => HH.modals.plans(data),
		scheduled: () => HH.modals.scheduled(data),
		projects: () => HH.modals.projects(data),
		wip: () => HH.modals.wip(data, {}),
		'wip-projects': () => HH.modals.wip(data, { byProject: true })
	};
	const app = document.getElementById('app');
	const modal = modals[screen] ? modals[screen]() : '';
	app.innerHTML = HH.root.render(data) + modal;
	app.dataset.screen = screen;
	app.dataset.state = state;
	if (modal) document.documentElement.classList.add('hh-modal-open');
})();
