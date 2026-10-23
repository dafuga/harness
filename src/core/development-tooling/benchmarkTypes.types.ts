import type { z } from 'zod';
import type { benchMeasurementSchema, kernelBenchmarkSchema } from './benchmarkTypes';

export type BenchMeasurement = z.infer<typeof benchMeasurementSchema>;

export type KernelBenchmark = z.infer<typeof kernelBenchmarkSchema>;
