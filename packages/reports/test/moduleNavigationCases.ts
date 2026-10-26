import { standardCodeModules } from '../../../src/templates/module-system/standardCodeModules';
import { expect } from 'vitest';
import type { HarnessNavbarInput } from '../src/utils/explorer-ui/harnessShell.types';
import { harnessShell } from '../src/components/explorer-ui/harness-navbar/harnessShell';
/** In-memory inputs keep array admission behavior; JSON serialization is not a characterization. */
export function assertModuleArrayAdmission(input: HarnessNavbarInput): void {
	const original = input.modules!.modules.find((entry) => entry.definition.id === 'email')!;
	let reads = 0;
	const definition = { ...original.definition };
	Object.defineProperty(definition, 'resources', {
		get() {
			reads++;
			return original.definition.resources;
		}
	});
	const entries = [{ ...original, definition }];
	Object.defineProperty(entries, Symbol.iterator, {
		value() {
			throw new Error('own iterator must not run');
		}
	});
	const props = { ...input, modules: { gaps: [], modules: entries } };
	expect(harnessShell(props).modules.some((item) => item.id === 'resource:email.email')).toBe(true);
	expect(reads).toBe(1);
	class SpeciesArray extends Array {
		static get [Symbol.species](): ArrayConstructor {
			throw new Error('species admission retained');
		}
	}
	Object.setPrototypeOf(entries, SpeciesArray.prototype);
	expect(() => harnessShell(props)).toThrow('species admission retained');
}

/** Frozen included definitions retain their generators while the public catalog uses Plugins. */
export function assertLegacyLibraryNavigation(input: HarnessNavbarInput): void {
	const modules = standardCodeModules.map((definition) => ({
		definition:
			definition.id === 'modules'
				? {
						...definition,
						title: 'Modules',
						visibility: undefined,
						resources: definition.resources.map((resource) => ({ ...resource, title: 'Modules' }))
					}
				: definition,
		source: 'builtin' as const,
		installed: true,
		instances: []
	}));
	const scope = input.scope!;
	const result = harnessShell({
		...input,
		modules: { modules, gaps: [] },
		scope: {
			...scope,
			location: { ...scope.location, category: 'pages', screen: 'modules' }
		}
	});
	expect(result.modules.find((item) => item.id === 'module-library')).toMatchObject({
		label: 'Plugins',
		active: true
	});
}
