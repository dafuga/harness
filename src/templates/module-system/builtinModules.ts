import { emailModule } from './emailModule';
import { offlineModule } from './offlineModule';
import { moduleDefinitionSchema } from '../../services/module-system/moduleDefinition';

/** Bundled capability definitions use exactly the same admission contract as project modules. */
export const builtinModules = [emailModule, offlineModule].map((definition) =>
	moduleDefinitionSchema.parse(definition)
);
