import { contractSummaries } from '../../../../src/modules/contracts/contract-summary';
import type { ContractEntity } from '../../../../src/modules/contracts/contract.entity';
import { ListProjectsUseCase } from '../../../../src/modules/projects/application/use-cases/list-projects.use-case';
import { UserRole } from '../../../../src/modules/auth/domain/enums/user.enums';
import { PermissionScope } from '../../../../src/modules/users/domain/enums/permission-scope.enum';

const contract = (
  projectId: number,
  number: string,
  data: Partial<ContractEntity['data']>,
) =>
  ({
    projectId,
    number,
    data: {
      currency: 'BRL',
      current_value: null,
      services: [],
      status: 'active',
      ...data,
    },
  }) as ContractEntity;

describe('Resumo do contrato na listagem de projetos', () => {
  it('soma o valor vigente exato, guarda a primeira data e junta segmentos e serviços', () => {
    const map = contractSummaries([
      contract(1, 'C-2', {
        contracted_on: '2026-03-10',
        current_value: '0.20',
        segment: 'Indústria',
        estimated_assets: 100,
        recurring: false,
        services: ['Inventário'],
      }),
      contract(1, 'C-1', {
        contracted_on: '2025-01-05',
        current_value: '0.10',
        segment: 'Indústria',
        estimated_assets: 50,
        recurring: true,
        services: ['Inventário', 'Avaliação'],
      }),
      contract(1, 'C-3', { status: 'cancelled', current_value: '999.00' }),
      contract(2, 'X', {}),
    ]);
    expect(map.get(1)).toEqual({
      count: 2,
      numbers: ['C-1', 'C-2'],
      contracted_on: '2025-01-05',
      segments: ['Indústria'],
      currency: 'BRL',
      current_value: '0.30',
      missing_value: 0,
      estimated_assets: 150,
      recurring: true,
      services: ['Inventário', 'Avaliação'],
    });
    expect(map.get(2)).toMatchObject({
      current_value: null,
      missing_value: 1,
      estimated_assets: null,
      recurring: null,
      contracted_on: null,
    });
  });
  it('não soma moedas diferentes', () => {
    const map = contractSummaries([
      contract(1, 'A', { current_value: '10.00' }),
      contract(1, 'B', { current_value: '5.00', currency: 'USD' }),
    ]);
    expect(map.get(1)).toMatchObject({ currency: null, current_value: null });
  });
});

describe('ListProjectsUseCase com contratos', () => {
  const project = {
    id: 7,
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  } as never;
  const repository = {
    list: jest
      .fn()
      .mockResolvedValue({ items: [project], total: 1, counts: {} }),
  };
  const scope = { resolveOrganizationFilter: () => 1 };
  const find = jest
    .fn()
    .mockResolvedValue([
      contract(7, 'C-1', { current_value: '1500.00', segment: 'Varejo' }),
    ]);
  const ds = { getRepository: () => ({ find }) };
  const resolver = {
    findScopesByKeys: jest
      .fn()
      .mockResolvedValue(
        new Map([['contracts:read', PermissionScope.ORGANIZATION]]),
      ),
  };
  const useCase = () =>
    new ListProjectsUseCase(
      repository as never,
      scope as never,
      ds as never,
      resolver as never,
    );
  beforeEach(() => find.mockClear());

  it('anexa o resumo para quem lê contratos', async () => {
    const result = await useCase().execute(
      {},
      {
        id: 1,
        organizationId: 1,
        systemRoles: [UserRole.ORG_ADMIN],
      },
    );
    expect((result.items[0] as { contract?: unknown }).contract).toMatchObject({
      current_value: '1500.00',
      segments: ['Varejo'],
    });
  });
  it('omite o campo para quem não lê contratos', async () => {
    const result = await useCase().execute(
      {},
      {
        id: 2,
        organizationId: 1,
        systemRoles: [UserRole.ORG_USER],
        permissions: [
          { key: 'projects:read', scope: PermissionScope.ORGANIZATION },
        ],
      },
    );
    expect(result.items[0]).not.toHaveProperty('contract');
    expect(find).not.toHaveBeenCalled();
  });
});
