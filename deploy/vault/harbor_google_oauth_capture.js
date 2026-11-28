/* global document, location, URL, URLSearchParams, CSSStyleSheet, MutationObserver, Event, getComputedStyle, setTimeout, clearTimeout */
// Run as a bookmarklet from the Harbor test project's client list, after the watcher is READY.
(() => {
	const project = 'harbor-calendar-oauth-test';
	const origin = 'https://console.cloud.google.com';
	const clients = '/auth/clients';
	const createPage = clients + '/create';
	const clientName = 'Harbor Calendar Desktop Test';
	const root = document.documentElement;
	const matches = (path) =>
		location.origin === origin &&
		location.pathname === path &&
		new URLSearchParams(location.search).getAll('project').join(',') === project;
	const label = (element) =>
		(element.getAttribute('aria-label') || element.textContent).trim().replace(/\s+/g, ' ');
	const unique = (parent, selector, predicate) => {
		const matching = [...parent.querySelectorAll(selector)].filter(predicate);
		return matching.length === 1 ? matching[0] : null;
	};
	const control = (parent, name) =>
		unique(parent, 'button,a,[role="button"]', (element) => label(element) === name);

	if (!matches(clients) || root.dataset.harborCapture) return;
	const addClient = control(document, 'Create client');
	if (!addClient || !matchesCreateLink(addClient.href)) return;
	if ([...document.querySelectorAll('table a')].some((link) => label(link) === clientName)) return;

	// Keep result contents hidden until the task-owned tab is closed, even on failure.
	const cover = new CSSStyleSheet();
	cover.replaceSync('*, *::backdrop { visibility: hidden !important; }');
	document.adoptedStyleSheets = [...document.adoptedStyleSheets, cover];
	root.style.setProperty('opacity', '0', 'important');
	if (!isCovered(root)) return;
	root.setAttribute('aria-hidden', 'true');
	root.dataset.harborCapture = 'opening';
	let step = openApplicationTypes;

	const observer = new MutationObserver(advance);
	const deadline = setTimeout(() => observer.disconnect(), 60_000);
	observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
	addClient.click();
	advance();

	function matchesCreateLink(href) {
		const url = new URL(href, location.href);
		return (
			url.origin === origin &&
			url.pathname === createPage &&
			url.searchParams.getAll('project').join(',') === project
		);
	}

	function advance() {
		if (!matches(createPage) && !matches(clients)) return;
		if (isCovered(root)) step();
	}

	function isCovered(element) {
		return (
			getComputedStyle(root).opacity === '0' && getComputedStyle(element).visibility === 'hidden'
		);
	}

	function openApplicationTypes() {
		if (!matches(createPage)) return;
		const combobox = unique(document, '[role="combobox"]', (element) =>
			(element.getAttribute('aria-label') || associatedLabel(element)).includes('Application type')
		);
		if (!combobox) return;
		step = chooseDesktop;
		combobox.click();
	}

	function associatedLabel(element) {
		return (element.getAttribute('aria-labelledby') || '')
			.split(/\s+/)
			.map((id) => document.getElementById(id)?.textContent || '')
			.join(' ');
	}

	function chooseDesktop() {
		const option = unique(
			document,
			'[role="option"]',
			(element) => label(element) === 'Desktop app'
		);
		if (!option) return;
		step = setName;
		option.click();
	}

	function setName() {
		const name = unique(
			document,
			'input',
			(input) =>
				!input.disabled &&
				input.type === 'text' &&
				(input.getAttribute('aria-label') === 'Name' ||
					associatedLabel(input).trim() === 'Name' ||
					[...(input.labels || [])].some((entry) => label(entry) === 'Name'))
		);
		if (!name) return;
		step = submitClient;
		name.value = clientName;
		name.dispatchEvent(new Event('input', { bubbles: true }));
		name.dispatchEvent(new Event('change', { bubbles: true }));
		submitClient();
	}

	function submitClient() {
		if (!matches(createPage)) return;
		const desktop = unique(
			document,
			'[role="combobox"]',
			(element) => label(element) === 'Desktop app'
		);
		const name = unique(document, 'input', (input) => input.value === clientName);
		const create = control(document, 'Create');
		if (!desktop || !name || !create || create.disabled || !create.form || !isCovered(create))
			return;
		create.form.addEventListener('submit', (event) => event.preventDefault(), {
			capture: true,
			once: true
		});
		step = downloadClient;
		root.dataset.harborCapture = 'submitted';
		create.click();
	}

	function downloadClient() {
		const dialog = unique(document, 'dialog,[role="dialog"]', (element) => {
			const heading = element.querySelector('h1,h2,h3,[role="heading"]');
			return heading && /^OAuth (?:2\.0 )?client (?:ID )?created$/i.test(label(heading));
		});
		if (!dialog) return;
		const download = control(dialog, 'Download JSON');
		if (!download || download.disabled) return;
		observer.disconnect();
		clearTimeout(deadline);
		root.dataset.harborCapture = 'download';
		download.click();
	}
})();
