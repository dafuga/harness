import type { Manifest } from './service-contract.test.types';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type { HarnessRevision } from '../../src/models/Harness.types';
import { content, words } from '../entityRender';
import { record, revision } from '../entityFixture';
import {
	agentActivity,
	orderFeed,
	serviceUnit,
	withServiceContracts
} from '../entityServiceContract';
import { commits, ids } from '../entityUnits';

const head = () => withServiceContracts(revision(commits.tip, [record(commits.tip)]));
const contractOf = (entity: string, detail: HarnessRevision = head()) =>
	content('current', { category: 'services', entity, tab: 'contract' }, { head: detail });
/** The method sections of a contract, in the order they are shown. */
const methodsIn = (body: string) =>
	[...body.matchAll(/<section[^>]*aria-label="([^"]+) method"/g)].map((found) => found[1]);
/** Words as a person reads them, a generic type as it is written. */
const read = (markup: string) => words(markup).replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** The markup of one method section; a section holds tables and never another section. */
function methodOf(body: string, method: string): string {
	const opened = body.indexOf(`aria-label="${method} method"`);
	return opened < 0 ? '' : body.slice(opened, body.indexOf('</section>', opened));
}

test('service contracts group parameters, return and errors by method, with initialize', () => {
	// The unit is titled by what it does; only revision metadata names its class.
	expect(orderFeed.title).not.toContain(orderFeed.className);
	const body = contractOf(orderFeed.id);
	expect(methodsIn(body)).toEqual(['constructor', 'initialize', 'latest']);
	// The former rendering had one class-wide table of each; none of them is left.
	for (const group of ['Inputs', 'Outputs']) expect(body).not.toContain(`aria-label="${group}"`);
	const initialize = methodOf(body, 'initialize');
	expect(read(initialize)).toContain('initialize(timeoutMs)');
	expect(read(initialize)).toContain('Promise<void>');
	expect(read(initialize)).not.toContain('timeoutMs: number');
	for (const group of ['Parameters', 'Returns'])
		expect(initialize).toContain(`aria-label="${group}"`);
	expect(initialize).not.toContain('aria-label="Throws"');
	expect(body.indexOf('aria-label="Errors"')).toBeGreaterThan(
		body.indexOf('aria-label="latest method"')
	);
	expect(words(body)).toContain('TimeoutError');
	expect(initialize).toContain('View example for timeoutMs');
	expect(words(initialize)).not.toContain('TimeoutError');
	const constructed = methodOf(body, 'constructor');
	expect(read(constructed)).toContain('constructor(accountId)');
	expect(constructed).not.toContain('aria-label="Returns"');
	expect(words(constructed)).toContain('Creates the service.');
	const latest = methodOf(body, 'latest');
	expect(read(latest)).toContain('latest()');
	expect(read(latest)).toContain('Promise<Order[]>');
	expect(words(latest)).toContain('No parameters.');
	expect(latest).not.toContain('aria-label="Throws"');
	expect(words(latest)).not.toContain('No errors declared for this method.');
	expect(words(latest)).not.toContain('TimeoutError');
	expect(words(body)).toContain('Runs as');
	expect(words(body)).not.toContain('not tied to a method');
});

test('an older revision without class metadata reads methods from qualified names', () => {
	const detail = head();
	const feed = detail.registry.units.find((unit) => unit.id === orderFeed.id)!;
	delete feed.serviceClasses;
	const body = contractOf(orderFeed.id, detail);
	expect(methodsIn(body)).toEqual(['constructor', 'initialize', 'latest']);
	expect(read(methodOf(body, 'initialize'))).toContain('initialize(timeoutMs)');
});

test('each class of a service keeps its own methods, same-named ones apart', () => {
	const detail = head();
	detail.registry.units = detail.registry.units.map((unit) => {
		if (unit.id !== orderFeed.id) return unit;
		const [recorded] = unit.serviceClasses!;
		const { inputs, outputs, errors } = unit.contract;
		return {
			...unit,
			serviceClasses: [recorded, { ...recorded, name: 'OrderArchive', methods: ['latest'] }],
			contract: {
				inputs: [...inputs, { name: 'OrderArchive.latest.before', type: 'string' }],
				outputs: [...outputs, { name: 'OrderArchive.latest', type: 'Promise<Archived[]>' }],
				errors
			}
		};
	});
	const body = contractOf(orderFeed.id, detail);
	expect(methodsIn(body)).toEqual([
		'OrderFeed.constructor',
		'OrderFeed.initialize',
		'OrderFeed.latest',
		'OrderArchive.latest'
	]);
	const feed = read(methodOf(body, 'OrderFeed.latest'));
	expect(feed).toContain('OrderFeed.latest()');
	expect(feed).not.toMatch(/before|Archived/);
	const archive = read(methodOf(body, 'OrderArchive.latest'));
	expect(archive).toContain('OrderArchive.latest(before)');
	expect(archive).toContain('Promise<Archived[]>');
	expect(archive).not.toMatch(/Promise<Order\[\]>|TimeoutError/);
});

test('AgentActivityService shows each method it declares now, its class-wide error once', () => {
	const path = '../../../../specification/units/service.agent-activity.json';
	const manifest = JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as Manifest;
	const prefix = `${agentActivity.className}.`;
	const named = manifest.owns.symbols.filter((symbol) => symbol.startsWith(prefix));
	const declared = [...new Set(named.map((symbol) => symbol.slice(prefix.length)))];
	expect(declared).toEqual(
		expect.arrayContaining(['constructor', 'register', 'heartbeat', 'finish', 'roster'])
	);
	// The recorded methods are the public ones its selected source declares; initialize is not.
	const entry = `../../../../${manifest.runtime.targets[0].entry}`;
	const source = readFileSync(new URL(entry, import.meta.url), 'utf8');
	const members = [...source.matchAll(/^\t(?:async )?(\w+)\(/gm)].map((found) => found[1]);
	expect(['constructor', ...agentActivity.methods]).toEqual(members);
	const now = { ...agentActivity, symbols: manifest.owns.symbols, contract: manifest.contract };
	const detail = head();
	detail.registry.units = detail.registry.units.map((unit) =>
		unit.id === agentActivity.id ? serviceUnit(now) : unit
	);
	const body = contractOf(agentActivity.id, detail);
	expect(methodsIn(body), 'every declared method has its own section').toEqual(declared);
	const mirrored = methodsIn(contractOf(agentActivity.id));
	expect(mirrored, 'the browser fixture shows the same methods').toEqual(declared);
	expect(words(methodOf(body, 'roster'))).toContain('No parameters.');
	expect(words(body)).not.toContain('Errors not tied to a method');
	expect(body.indexOf('aria-label="Errors"')).toBeGreaterThan(
		body.indexOf('aria-label="roster method"')
	);
	expect(words(body).split('ExpectedCliError')).toHaveLength(2);
	for (const group of ['Inputs', 'Outputs']) expect(body).not.toContain(`aria-label="${group}"`);
});

test('a service contract that names no method keeps its fields together', () => {
	const body = contractOf(ids.store);
	expect(methodsIn(body)).toEqual([]);
	expect(body).toContain('aria-label="Inputs"');
	expect(body).toContain('aria-label="Outputs"');
	expect(words(body)).not.toContain('not tied to a method');
});

test.each([true, false])(
	'CRUD methods lead in semantic order with recorded class metadata %s',
	(recorded) => {
		const methods = [
			'latest',
			'update',
			'findBy',
			'delete',
			'create',
			'find',
			'read',
			'initialize',
			'create'
		];
		const unit = serviceUnit({
			...orderFeed,
			methods,
			contract: {
				...orderFeed.contract,
				outputs: [
					...orderFeed.contract.outputs,
					...['update', 'findBy', 'delete', 'create', 'find', 'read'].map((name) => ({
						name: `OrderFeed.${name}`,
						type: 'Promise<Order>'
					}))
				]
			}
		});
		if (!recorded) delete unit.serviceClasses;
		const detail = head();
		detail.registry.units = detail.registry.units.map((item) =>
			item.id === unit.id ? unit : item
		);
		expect(methodsIn(contractOf(unit.id, detail))).toEqual([
			'create',
			'findBy',
			'find',
			'read',
			'update',
			'delete',
			'constructor',
			...(recorded ? ['latest', 'initialize'] : ['initialize', 'latest'])
		]);
	}
);
