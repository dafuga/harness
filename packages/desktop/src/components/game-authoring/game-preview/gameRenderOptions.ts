export function gameRenderOptions() {
	return {
		restyle: { label: 'Lucy Restyle', model: 'lucy-restyle-2', fast: false, rate: 0.6 },
		lucy: { label: 'Lucy 2.5', model: 'lucy-2.5', fast: false, rate: 1.2 },
		fast: { label: 'Lucy 2.5 Fast', model: 'lucy-2.5', fast: true, rate: 2.4 }
	} as const;
}
