import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Validates and PARSES a request payload against a Zod schema. Because Zod
 * objects strip unknown keys by default, this also guards against mass
 * assignment — only declared fields survive.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
