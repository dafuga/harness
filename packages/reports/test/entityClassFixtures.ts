/** Class evidence shared by the normal catalog, detail and browser fixtures. */
export function serviceClassProof(
	name = 'OrderStore',
	source = 'src/services/OrderStore.ts',
	consumers: Array<{ unit: string }> = []
) {
	return {
		name,
		source,
		methods: ['read', 'write'],
		constructedBy: consumers.slice(0, 1),
		consumers
	};
}

export function serviceMetadata(
	consumers: Array<{ unit: string }> = [],
	name?: string,
	source?: string
) {
	return {
		serviceConsumers: consumers,
		serviceClasses: [serviceClassProof(name, source, consumers)]
	};
}

/** Fail closed when declaration, instance, method or per-class sharing proof is absent. */
export function invalidServiceClasses(proof: ReturnType<typeof serviceClassProof>) {
	return [
		undefined,
		[],
		[{ ...proof, methods: ['read'] }],
		[{ ...proof, methods: [] }],
		[{ ...proof, constructedBy: [] }],
		[{ ...proof, name: 'orderStore' }],
		[{ ...proof, consumers: proof.consumers.slice(0, 1) }],
		[{ ...proof, source: 'src/unowned.ts' }]
	];
}
