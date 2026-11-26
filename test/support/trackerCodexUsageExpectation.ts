export function expectedTokenUsage(missing: boolean) {
	if (!missing)
		return {
			input_tokens: 95,
			output_tokens: 10,
			cache_read_tokens: 25,
			cache_write_tokens: 0,
			credits_balance: '12.50'
		};
	return {
		credits_balance: null,
		input_tokens: null,
		output_tokens: null,
		cache_read_tokens: null,
		cache_write_tokens: null
	};
}
