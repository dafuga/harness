import { z } from 'zod';
import type {
	TestJson,
	JsonRecordSchema,
	JsonParsePayload,
	JsonParseContext,
	JsonMemoizer
} from './testJsonSchema.types';

// Initialize before Zod's deferred parser wrappers so cycle handling and schema exports survive.
const JsonRecord = z.core.$constructor<JsonRecordSchema>('TestJsonRecord', (schema, definition) => {
	z.ZodRecord.init(schema, definition);
	const memo = z.core.globalConfig.memoizer;
	schema._zod.parse = (payload, context) => parseRecord(schema, memo, payload, context);
});

/** Authored JSON and response evidence retain every field without invoking prototype setters. */
export const testJsonSchema: z.ZodType<TestJson> = z.lazy(() =>
	z.union([
		z.string(),
		z.number(),
		z.boolean(),
		z.null(),
		z.array(testJsonSchema),
		new JsonRecord({ type: 'record', keyType: z.string(), valueType: testJsonSchema })
	])
);

function parseRecord(
	schema: JsonRecordSchema,
	memo: JsonMemoizer,
	payload: JsonParsePayload,
	context: JsonParseContext
) {
	const input = payload.value;
	if (!z.core.util.isPlainObject(input)) {
		payload.issues.push({ expected: 'record', code: 'invalid_type', input, inst: schema });
		return payload;
	}
	payload.value = memo ? memo.alloc(schema, payload, {}, context) : {};
	const pending: Promise<void>[] = [];
	for (const key of Reflect.ownKeys(input)) {
		if (!Object.prototype.propertyIsEnumerable.call(input, key)) continue;
		if (!validKey(schema, key, payload, context)) continue;
		const result = schema.valueType._zod.run({ value: input[key], issues: [] }, context);
		if (result instanceof Promise)
			pending.push(result.then((parsed) => retainField(payload, key, parsed)));
		else retainField(payload, key, result);
	}
	return pending.length ? Promise.all(pending).then(() => payload) : payload;
}

function validKey(
	schema: JsonRecordSchema,
	key: PropertyKey,
	payload: JsonParsePayload,
	context: JsonParseContext
): boolean {
	const result = schema.keyType._zod.run({ value: key, issues: [] }, context);
	if (result instanceof Promise)
		throw new Error('Async schemas not supported in object keys currently');
	if (!result.issues.length) return true;
	payload.issues.push({
		code: 'invalid_key',
		origin: 'record',
		issues: result.issues.map((issue) =>
			z.core.util.finalizeIssue(issue, context, z.core.config())
		),
		input: key,
		path: [key],
		inst: schema
	});
	return false;
}

function retainField(payload: JsonParsePayload, key: PropertyKey, parsed: JsonParsePayload): void {
	payload.issues.push(...z.core.util.prefixIssues(key, parsed.issues));
	Object.defineProperty(payload.value, key, {
		value: parsed.value,
		writable: true,
		enumerable: true,
		configurable: true
	});
}
