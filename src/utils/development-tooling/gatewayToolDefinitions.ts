import type { GatewayItem } from './gatewayTypes';
export function gatewayToolDefinitions(definitions: GatewayItem[]): GatewayItem[] {
	return definitions.flatMap((definition) => {
		if (definition.type === 'namespace') {
			if (!Array.isArray(definition.tools)) throw new Error('Invalid namespace tools');
			return gatewayToolDefinitions(definition.tools).map((tool) => ({
				...tool,
				namespace: definition.name
			}));
		}
		if (!['function', 'custom'].includes(String(definition.type)))
			throw new Error('Unsupported hosted tool; disable it explicitly for this provider');
		return [definition];
	});
}
