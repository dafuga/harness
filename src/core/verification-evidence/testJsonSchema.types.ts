import type { z } from 'zod';

export type TestJson = z.core.util.JSONType;
export type JsonRecordSchema = z.ZodRecord<z.ZodString, z.ZodType<TestJson>>;
export type JsonParsePayload = z.core.ParsePayload;
export type JsonParseContext = z.core.ParseContextInternal;
export type JsonMemoizer = z.core.$ZodMemoizer | undefined;
