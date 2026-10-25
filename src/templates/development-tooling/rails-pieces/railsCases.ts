export const valueCase = (title: string, call: string, expected: string) => ({
	title,
	call,
	expected
});
export const errorCase = (title: string, call: string, error: string) => ({
	title,
	call,
	throws: error
});
const formLaunch = "{ title: 'Launch' }";

export const channelCases = [
	valueCase('subscribe counts the first subscriber', 'subscribe()', '1'),
	{ ...valueCase('subscribe counts again', 'subscribe()', '2'), steps: ['subscribe()'] },
	{
		...valueCase(
			'broadcast from no subscribers returns the payload',
			"broadcast('hello')",
			"'hello'"
		),
		checks: [errorCase('reject empty payload', "broadcast('')", 'RangeError')]
	},
	{
		...valueCase(
			'broadcast from subscribed state returns the payload',
			"broadcast('hello')",
			"'hello'"
		),
		steps: ['subscribe()'],
		checks: [errorCase('reject empty payload', "broadcast('')", 'RangeError')]
	}
];

export const formCases = [
	valueCase('validate flags an empty form', 'validate()', "['values are required']"),
	{ ...valueCase('validate accepts values', 'validate()', '[]'), init: formLaunch },
	{ ...valueCase('toPayload returns the values', 'toPayload()', formLaunch), init: formLaunch },
	valueCase('toPayload is empty for an empty form', 'toPayload()', '{}'),
	{
		...errorCase(
			'validate from invalid initialization rejects null values',
			'validate()',
			'TypeError'
		),
		init: 'null as never'
	},
	{
		...valueCase(
			'toPayload from invalid initialization returns an empty record',
			'toPayload()',
			'{}'
		),
		init: 'null as never'
	}
];

export const middlewareCases = [
	{
		...valueCase('handle passes the same request through', 'handle(request)', 'request'),
		arrange: ["const request = new Request('https://example.test/');"],
		identity: true,
		checks: [
			errorCase('handle rejects a missing request', 'handle(undefined as never)', 'TypeError')
		]
	}
];
