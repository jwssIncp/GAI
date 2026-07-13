import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

interface MysqlDriverError {
  code?: string;
  errno?: number;
  message?: string;
}

export type FieldAgentConflictField = 'email' | 'document';

export class ActiveAssignmentExistsError extends Error {
  constructor() {
    super('Active project field agent assignment already exists');
    this.name = ActiveAssignmentExistsError.name;
  }
}

export function fieldAgentConflict(
  field: FieldAgentConflictField,
): ConflictException {
  const label = field === 'email' ? 'e-mail' : 'CPF/CNPJ';
  return new ConflictException({
    code: 'CONFLICT',
    message: `Já existe um inventariante com este ${label}.`,
    details: [{ field, message: `${label} já cadastrado` }],
  });
}

export function activeAssignmentConflict(): ConflictException {
  return new ConflictException({
    code: 'CONFLICT',
    message: 'O inventariante já possui vínculo ativo com este projeto.',
    details: [
      { field: 'field_agent_id', message: 'Vínculo ativo já existente' },
    ],
  });
}

export function duplicateFieldFromDatabase(
  error: unknown,
): FieldAgentConflictField | null {
  if (!(error instanceof QueryFailedError)) return null;
  const driverError = error.driverError as MysqlDriverError;
  if (driverError.code !== 'ER_DUP_ENTRY' && driverError.errno !== 1062)
    return null;
  const message = driverError.message ?? error.message;
  if (message.includes('uq_field_agents_org_email')) return 'email';
  if (message.includes('uq_field_agents_org_document')) return 'document';
  return null;
}

export function isActiveAssignmentDuplicate(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = error.driverError as MysqlDriverError;
  return (
    (driverError.code === 'ER_DUP_ENTRY' || driverError.errno === 1062) &&
    (driverError.message ?? error.message).includes(
      'uq_project_field_agents_active_key',
    )
  );
}
