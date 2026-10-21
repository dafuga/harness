interface CallableContract {
	pure?: boolean;
	consumers?: Array<{ unit: string; symbol?: string }>;
}

/** Eligibility is shared by all renderers; missing contracts are never assumed pure. */
export function helperContract(helper: CallableContract): boolean {
	return (
		helper.pure === true &&
		new Set(helper.consumers?.map((consumer) => `${consumer.unit}#${consumer.symbol ?? ''}`))
			.size >= 2
	);
}
