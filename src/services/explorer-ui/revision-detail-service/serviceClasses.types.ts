// @harness-uid u_44u5mzzjmu

import type {
	HelperFacts,
	HelperBinding,
	HelperReference
} from '../../../utils/explorer-ui/helperReferences';
import type { HelperConsumer } from '../../../utils/explorer-ui/helperConsumers';

export type Facts = Map<string, HelperFacts>;

export type Definition = NonNullable<HelperFacts['classes']>[number] & { source: string };

export interface Lookup {
	users: Map<string, Map<string, HelperConsumer>>;
	target(path: string, binding: HelperBinding): string | undefined;
	reference(path: string, reference: HelperReference): string | undefined;
}

export interface ProofContext {
	facts: Facts;
	lookup: Lookup;
	constructed: Map<string, Set<string>>;
}
