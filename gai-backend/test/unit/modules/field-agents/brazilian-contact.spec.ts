import { QueryFailedError } from 'typeorm';
import {
  duplicateFieldFromDatabase,
  isActiveAssignmentDuplicate,
} from '../../../../src/modules/field-agents/application/errors/field-agent-conflict';
import {
  isValidBrazilianDocument,
  isValidBrazilianPhone,
  normalizeBrazilianDocument,
  normalizeBrazilianPhone,
} from '../../../../src/modules/field-agents/domain/validation/brazilian-contact';

describe('Brazilian field-agent contact validation', () => {
  it.each(['529.982.247-25', '11.222.333/0001-81'])(
    'accepts valid document %s',
    (value) => {
      expect(isValidBrazilianDocument(value)).toBe(true);
    },
  );

  it.each(['11111111111', '52998224724', '11222333000180', '123'])(
    'rejects invalid document %s',
    (value) => {
      expect(isValidBrazilianDocument(value)).toBe(false);
    },
  );

  it('normalizes documents and phones', () => {
    expect(normalizeBrazilianDocument('529.982.247-25')).toBe('52998224725');
    expect(normalizeBrazilianPhone('+55 (11) 99999-8888')).toBe('11999998888');
  });

  it.each(['(11) 3333-4444', '+55 11 99999-8888'])(
    'accepts valid phone %s',
    (value) => {
      expect(isValidBrazilianPhone(value)).toBe(true);
    },
  );

  it.each(['119999', '11 99999-8888 ramal 2', '0011999998888'])(
    'rejects invalid phone %s',
    (value) => {
      expect(isValidBrazilianPhone(value)).toBe(false);
    },
  );

  it('does not turn unrelated database failures into conflicts', () => {
    const error = new QueryFailedError('SELECT 1', [], {
      code: 'ER_LOCK_WAIT_TIMEOUT',
    });
    expect(duplicateFieldFromDatabase(error)).toBeNull();
    expect(isActiveAssignmentDuplicate(error)).toBe(false);
  });
});
