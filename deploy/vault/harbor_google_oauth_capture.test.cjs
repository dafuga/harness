/* global __dirname, URL, URLSearchParams, Event */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

const source = readFileSync(join(__dirname, 'harbor_google_oauth_capture.js'), 'utf8');
const url = 'https://console.cloud.google.com/auth/clients?project=harbor-calendar-oauth-test';
const named = (text, fields = {}) => ({
	textContent: text,
	getAttribute: (attribute) => (attribute === 'aria-label' ? text : null),
	...fields
});

function simulate(options = {}) {
	const observations = [];
	const location = new URL(options.url || url);
	let stage = 'list';
	let observer;
	const root = {
		dataset: {},
		style: { setProperty: () => observations.push('masked') },
		setAttribute: () => observations.push('hidden from accessibility')
	};
	const name = named('Name', { type: 'text', dispatchEvent() {} });
	const add = named('Create client', {
		href: url.replace('/clients?', '/clients/create?'),
		click() {
			location.pathname = '/auth/clients/create';
			stage = 'form';
		}
	});
	const combo = named('Application type', { click: () => (stage = 'options') });
	const option = named('Desktop app', { click: () => (stage = 'desktop') });
	const create = named('Create', {
		form: { addEventListener() {} },
		click: () => {
			observations.push('created');
			stage = 'result';
			location.pathname = '/auth/clients';
		}
	});
	const dialog = {
		querySelector: () => named(options.heading || 'OAuth client created'),
		querySelectorAll: () => [
			named('Download JSON', { click: () => observations.push('downloaded') })
		]
	};
	const byStage = {
		list: { 'button,a,[role="button"]': [add] },
		form: { '[role="combobox"]': [combo] },
		options: { '[role="option"]': [option] },
		desktop: {
			'[role="combobox"]': [named('Desktop app')],
			input: [name],
			'button,a,[role="button"]': [create]
		},
		result: { 'dialog,[role="dialog"]': [dialog] }
	};
	const document = {
		documentElement: root,
		adoptedStyleSheets: [],
		querySelectorAll: (selector) => byStage[stage][selector] || []
	};
	runInNewContext(source, {
		document,
		location,
		URL,
		URLSearchParams,
		Event,
		getComputedStyle: () => ({
			opacity: options.maskFailed ? '1' : '0',
			visibility: options.coverFailed ? 'visible' : 'hidden'
		}),
		CSSStyleSheet: class {
			replaceSync() {}
		},
		MutationObserver: class {
			constructor(callback) {
				observer = callback;
			}
			observe() {}
			disconnect() {
				observer = undefined;
			}
		},
		setTimeout() {},
		clearTimeout() {}
	});
	for (let tick = 0; tick < 8 && observer; tick++) observer();
	return observations;
}

test('masks the create action and downloads only from the OAuth success dialog', () => {
	assert.deepEqual(simulate(), ['masked', 'hidden from accessibility', 'created', 'downloaded']);
	assert.deepEqual(simulate({ heading: 'Something went wrong' }), [
		'masked',
		'hidden from accessibility',
		'created'
	]);
});

test('refuses a bad mask, creation-form launch, wrong project, and wrong origin', () => {
	assert.deepEqual(simulate({ maskFailed: true }), ['masked']);
	assert.deepEqual(simulate({ coverFailed: true }), ['masked']);
	for (const mismatch of [
		url.replace('/clients?', '/clients/create?'),
		url.replace('harbor-calendar-oauth-test', 'other'),
		url.replace('console.cloud.google.com', 'example.test')
	]) {
		assert.deepEqual(simulate({ url: mismatch }), []);
	}
});
