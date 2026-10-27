import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../../src/core/development-tooling/unitTypes';
import { moduleResourceLocation } from '../../../src/helpers/module-system/moduleResourceLocation';
import { TestExpectationService } from '../../../src/services/verification-evidence/TestExpectationService';
import type { ModuleResource } from '../../../src/services/module-system/moduleDefinition.types';
import type { ExplorerLocation } from '../../../src/utils/explorerRoute';
import manifest from '../../../specification/units/helper.module-system-module-resource-location.json' with { type: 'json' };
import { measureWorkload } from '../../support/measureWorkload';

type Scope = Pick<ExplorerLocation, 'branch' | 'commit'>;
type ThrowingCatalog = { $fixture: 'throwing-catalog'; message: string };

function isThrowingCatalog(value: ModuleResource | ThrowingCatalog): value is ThrowingCatalog {
	return '$fixture' in value && value.$fixture === 'throwing-catalog';
}

function checked(scope: Scope, module: string, resource: ModuleResource | ThrowingCatalog) {
	const input = [scope, module, resource];
	const example = manifest.testing.examples.find(
		(item) => JSON.stringify(item.input) === JSON.stringify(input)
	);
	const resourceCall = isThrowingCatalog(resource)
		? `{ get catalog() { throw new TypeError(${JSON.stringify(resource.message)}); } }`
		: JSON.stringify(resource);
	expect(example?.call, 'the displayed call uses the tested input').toBe(
		`moduleResourceLocation(${JSON.stringify(scope)}, ${JSON.stringify(module)}, ${resourceCall})`
	);
	const actual = isThrowingCatalog(resource) ? throwingResource(scope, module, resource) : resource;
	return measureWorkload(
		'helper.module-system-module-resource-location',
		'authored-resource-location-example',
		() => moduleResourceLocation(scope, module, actual)
	);
}

function throwingResource(scope: Scope, module: string, fixture: ThrowingCatalog): ModuleResource {
	// Nullish inputs are invalid too; engine-specific TypeError messages are not part of this contract.
	expect(() =>
		moduleResourceLocation(null as unknown as Scope, module, {} as ModuleResource)
	).toThrow(TypeError);
	expect(() => moduleResourceLocation(scope, module, null as unknown as ModuleResource)).toThrow(
		TypeError
	);
	return {
		get catalog(): never {
			throw new TypeError(fixture.message);
		}
	} as unknown as ModuleResource;
}

new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	moduleResourceLocation: checked
});
