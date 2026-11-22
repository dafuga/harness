import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	scaffoldKinds,
	scaffoldDetails,
	isAppOnlyScaffold
} from '../../src/templates/development-tooling/scaffoldTypes';
import type { PieceKind } from '../../src/templates/development-tooling/scaffoldTypes.types';

const unitId = 'template.scaffold-types';

function captureError(run: () => unknown): unknown {
	try {
		run();
		return undefined;
	} catch (caught) {
		return caught;
	}
}

function summarise(kind: PieceKind) {
	const detail = scaffoldDetails[kind];
	return {
		kind: detail.kind,
		appOnly: detail.appOnly,
		gameOnly: detail.gameOnly,
		exampleCommand: detail.exampleCommand,
		containsCount: detail.contains.length
	};
}

test('Lists the 36 scaffold kinds in declaration order', () => {
	expect(scaffoldKinds).toHaveLength(36);
	expect(scaffoldKinds[0]).toBe('game-view');
	expect(scaffoldKinds[scaffoldKinds.length - 1]).toBe('middleware');

	recordExampleCases(
		{
			unitId,
			symbol: 'scaffoldKinds',
			state: 'lists-the-36-scaffold-kinds-in-declaration-order',
			evidence: 'examples-cases',
			file: 'lists-the-36-scaffold-kinds-in-declaration-order.json'
		},
		[
			{
				name: 'declared scaffold kinds in order',
				input: {},
				output: { count: scaffoldKinds.length, kinds: [...scaffoldKinds] }
			}
		]
	);
});

test('Reports app-only flags for component and service scaffolds', () => {
	const component = isAppOnlyScaffold('component');
	const service = isAppOnlyScaffold('service');
	expect(component).toBe(true);
	expect(service).toBe(false);

	recordExampleCases(
		{
			unitId,
			symbol: 'isAppOnlyScaffold',
			state: 'reports-app-only-flags-for-component-and-service-scaffolds',
			evidence: 'examples-cases',
			file: 'reports-app-only-flags-for-component-and-service-scaffolds.json'
		},
		[
			{ name: 'component is app-only', input: { kind: 'component' }, output: component },
			{ name: 'service is not app-only', input: { kind: 'service' }, output: service }
		]
	);
});

test('Maps each kind to its detail record', () => {
	const gameView = summarise('game-view');
	const config = summarise('config');
	expect(gameView.gameOnly).toBe(true);
	expect(config.gameOnly).toBeUndefined();
	expect(scaffoldDetails.service.exampleCommand).toBe('harness generate service example');

	recordExampleCases(
		{
			unitId,
			symbol: 'scaffoldDetails',
			state: 'maps-each-kind-to-its-detail-record',
			evidence: 'examples-cases',
			file: 'maps-each-kind-to-its-detail-record.json'
		},
		[
			{ name: 'game-view detail summary', input: { kind: 'game-view' }, output: gameView },
			{ name: 'config detail summary', input: { kind: 'config' }, output: config }
		]
	);
});

test('Throws a TypeError for a kind outside the scaffold list', () => {
	const kind = 'unknown-kind' as unknown as PieceKind;
	const error = captureError(() => isAppOnlyScaffold(kind));
	expect(error).toBeInstanceOf(TypeError);

	recordExampleCases(
		{
			unitId,
			symbol: 'isAppOnlyScaffold',
			state: 'throws-a-typeerror-for-a-kind-outside-the-scaffold-list',
			evidence: 'examples-cases',
			file: 'throws-a-typeerror-for-a-kind-outside-the-scaffold-list.json'
		},
		[
			{
				name: 'unknown kind reads appOnly of an undefined detail',
				input: { kind: 'unknown-kind' },
				error: {
					name: (error as Error).name,
					message: (error as Error).message
				}
			}
		]
	);
});
