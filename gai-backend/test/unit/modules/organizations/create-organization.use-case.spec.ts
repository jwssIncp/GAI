import { ConflictException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CreateOrganizationUseCase } from '../../../../src/modules/organizations/application/use-cases/create-organization.use-case';
import { Organization } from '../../../../src/modules/organizations/domain/entities/organization';
import { OrganizationStatus } from '../../../../src/modules/organizations/domain/enums/organization-status.enum';
import { Cnpj } from '../../../../src/modules/organizations/domain/value-objects/cnpj';

describe('CreateOrganizationUseCase', () => {
  const repository = {
    findByCnpj: jest.fn(),
    saveWithAudit: jest.fn(),
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
  } as unknown as PinoLogger;

  let useCase: CreateOrganizationUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreateOrganizationUseCase(repository as never, logger);
  });

  it('creates organization with valid data', async () => {
    repository.findByCnpj.mockResolvedValue(null);
    repository.saveWithAudit.mockImplementation(
      async (org: Organization) => org,
    );

    const result = await useCase.execute(
      {
        legal_name: 'Empresa Teste',
        cnpj: '11222333000181',
      },
      1,
    );

    expect(result.cnpj).toBe('11222333000181');
    expect(result.status).toBe(OrganizationStatus.ACTIVE);
    expect(repository.saveWithAudit).toHaveBeenCalled();
  });

  it('throws conflict for duplicate CNPJ', async () => {
    repository.findByCnpj.mockResolvedValue(
      new Organization({
        id: 2,
        legalName: 'Existing',
        tradeName: null,
        cnpj: Cnpj.fromPersisted('11222333000181'),
        contactEmail: null,
        contactPhone: null,
        status: OrganizationStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    await expect(
      useCase.execute({ legal_name: 'Dup', cnpj: '11222333000181' }, null),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
