import { standardCodeModules } from './standardCodeModules';
import { rustWasmModule } from './rustWasmModule';
import { rustBackendModule } from './rustBackendModule';
import { emailModule } from './emailModule';
import { offlineModule } from './offlineModule';
import { moduleDefinitionSchema } from '../../services/module-system/moduleDefinition';

/** Bundled capability definitions use exactly the same admission contract as project modules. */
export const builtinModules = [
	...standardCodeModules,
	emailModule,
	offlineModule,
	rustWasmModule,
	rustBackendModule
].map((definition) => moduleDefinitionSchema.parse(definition));
