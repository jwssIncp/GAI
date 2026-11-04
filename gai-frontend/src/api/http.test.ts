import { describe, expect, it } from 'vitest';
import { ApiError } from './http';

describe('API error wire compatibility', () => {
  it('normalizes Nest ValidationPipe arrays and preserves status and code', () => {
    const error = new ApiError(400, { code: 'VALIDATION_ERROR', message: ['size_bytes must not be less than 1', 'original_name must be a string'] });
    expect(error.message).toBe('size_bytes must not be less than 1; original_name must be a string');
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
  });
  it('preserves string errors, field details and structured domain details', () => {
    const details = [{ field: 'name', message: 'required' }];
    expect(new ApiError(400, { message: 'Invalid', details }).details).toEqual(details);
    const error = new ApiError(409, { message: 'Conflict', details: { status: 'closed' } });
    expect(error.message).toBe('Conflict');
    expect(error.rawDetails).toEqual({ status: 'closed' });
    expect(error.details).toBeUndefined();
    expect(new ApiError(0).message).toBe('Erro inesperado');
  });
});
