// @harness-uid u_cmdiu5nich
import type { GatewayItem } from './gatewayTypes';
import { GatewayToolDefinitionError } from './gatewayToolDefinitions.types';
export function gatewayToolDefinitions(definitions: GatewayItem[]): GatewayItem[] {
	return definitions.flatMap((definition) => {
		if (definition.type === 'namespace') {
			if (!Array.isArray(definition.tools))
				throw new GatewayToolDefinitionError('Invalid namespace tools');
			return gatewayToolDefinitions(definition.tools).map((tool) => ({
				...tool,
				namespace: definition.name
			}));
		}
		if (!['function', 'custom'].includes(String(definition.type)))
			throw new GatewayToolDefinitionError(
				'Unsupported hosted tool; disable it explicitly for this provider'
			);
		return [definition];
	});
}
