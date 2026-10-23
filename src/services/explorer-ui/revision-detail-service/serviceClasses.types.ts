import type { RevisionRegistry } from '../../../utils/revisionRegistry';
import type { HelperFacts } from '../../../utils/explorer-ui/helperReferences';
import type { HelperBinding } from '../../../utils/explorer-ui/helperReferences';
import type { HelperReference } from '../../../utils/explorer-ui/helperReferences';
import type { HelperConsumer } from '../../../utils/explorer-ui/helperConsumers';

export type Unit = RevisionRegistry['units'][number];

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
