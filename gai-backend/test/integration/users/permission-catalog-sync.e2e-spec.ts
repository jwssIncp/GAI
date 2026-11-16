import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RoleType } from '../../../src/modules/users/domain/enums/role-type.enum';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { RolePermissionEntity } from '../../../src/modules/users/infrastructure/persistence/role-permission.entity';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { UserRoleAssignmentEntity } from '../../../src/modules/users/infrastructure/persistence/user-role-assignment.entity';
import { UserEntity } from '../../../src/modules/auth/infrastructure/persistence/user.entity';
import {
  PERMISSION_SEEDS,
  seedPermissions,
} from '../../../src/scripts/seed/permissions.seed';
import { createTestApp, seedTestData } from '../test-app.helper';

type Row = Record<string, unknown>;

/**
 * Sincronização do catálogo no release (permissions:sync): só acrescenta as
 * chaves que faltam; não remove nada, não muda perfis nem atribuições e é
 * idempotente (a segunda execução não altera nenhuma linha).
 */
describe('Sincronização do catálogo de permissões (permissions:sync)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const TABLES: Array<[string, string]> = [
    ['permissions', 'id'],
    ['roles', 'id'],
    ['role_permissions', 'role_id, permission_id'],
    ['user_role_assignments', 'id'],
    ['users', 'id'],
  ];

  async function snapshot(): Promise<Record<string, Row[]>> {
    const result: Record<string, Row[]> = {};
    for (const [table, order] of TABLES)
      result[table] = await dataSource.query<Row[]>(
        `SELECT * FROM ${table} ORDER BY ${order}`,
      );
    return result;
  }

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria só as chaves que faltam, preserva perfis e vínculos e não muda nada na segunda execução', async () => {
    const permissions = dataSource.getRepository(PermissionEntity);
    const roles = dataSource.getRepository(RoleEntity);
    const links = dataSource.getRepository(RolePermissionEntity);
    const assignments = dataSource.getRepository(UserRoleAssignmentEntity);
    const users = dataSource.getRepository(UserEntity);

    // Perfil padrão da organização com uma permissão retirada.
    const operator = await roles.findOneByOrFail({ name: 'Operador' });
    const operatorLinks = await links.findBy({ roleId: operator.id });
    expect(operatorLinks.length).toBeGreaterThan(1);
    await links.delete({
      roleId: operator.id,
      permissionId: operatorLinks[0].permissionId,
    });

    // Perfil personalizado com um subconjunto de permissões.
    const now = new Date();
    const custom = await roles.save(
      roles.create({
        key: null,
        type: RoleType.ORGANIZATION,
        organizationId: operator.organizationId,
        name: 'Conferente (personalizado)',
        description: 'Perfil criado pela organização',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }),
    );
    const subset = (
      await permissions.findBy([
        { key: 'projects:read' },
        { key: 'inventory-items:read' },
      ])
    ).map((permission) =>
      links.create({ roleId: custom.id, permissionId: permission.id }),
    );
    expect(subset).toHaveLength(2);
    await links.save(subset);

    // Usuário com o perfil personalizado.
    const user = await users.findOneOrFail({
      where: { organizationId: operator.organizationId! },
      order: { id: 'ASC' },
    });
    await assignments.save(
      assignments.create({
        userId: user.id,
        roleId: custom.id,
        isActive: true,
        assignedBy: null,
        assignedAt: now,
        revokedAt: null,
      }),
    );

    // Chaves do catálogo ausentes no banco (sem vínculo com perfis).
    const linked = new Set(
      (await links.find()).map((link) => Number(link.permissionId)),
    );
    const removable = (await permissions.find({ order: { id: 'DESC' } }))
      .filter((permission) => !linked.has(Number(permission.id)))
      .slice(0, 3);
    expect(removable).toHaveLength(3);
    const missingKeys = removable.map(({ key }) => key).sort();
    await permissions.delete(removable.map(({ id }) => id));

    const before = await snapshot();

    const firstRun = await seedPermissions(dataSource);
    const afterFirst = await snapshot();

    // As chaves que faltavam foram criadas (e só elas).
    expect([...firstRun].sort()).toEqual(missingKeys);
    const catalog = new Set(
      (afterFirst.permissions as Array<{ key: string }>).map(({ key }) => key),
    );
    for (const seed of PERMISSION_SEEDS)
      expect(catalog.has(seed.key)).toBe(true);

    // Nenhuma permissão removida nem alterada.
    const afterById = new Map(
      afterFirst.permissions.map((row) => [row.id, row]),
    );
    for (const row of before.permissions)
      expect(afterById.get(row.id)).toEqual(row);
    expect(afterFirst.permissions).toHaveLength(
      before.permissions.length + missingKeys.length,
    );

    // Perfis, vínculos perfil×permissão, atribuições e usuários idênticos.
    for (const table of [
      'roles',
      'role_permissions',
      'user_role_assignments',
      'users',
    ])
      expect(afterFirst[table]).toEqual(before[table]);

    // Segunda execução: nada muda (nem descrições, nem datas).
    const secondRun = await seedPermissions(dataSource);
    expect(secondRun).toEqual([]);
    expect(await snapshot()).toEqual(afterFirst);
  });
});
