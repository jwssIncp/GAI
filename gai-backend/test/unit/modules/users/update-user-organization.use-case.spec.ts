import { UpdateUserUseCase } from '../../../../src/modules/users/application/use-cases/update-user.use-case';
describe('UpdateUserUseCase transactional facade', () => {
  it('delegates the complete request and actor to the lifecycle transaction', async () => {
    const lifecycle = { update: jest.fn().mockResolvedValue({ id: 10 }) };
    const useCase = new UpdateUserUseCase(lifecycle as never);
    const dto = {
      full_name: 'Pessoa Teste',
      login: 'person',
      email: 'person@example.com',
      role_ids: [3],
      activation_method: 'TEMPORARY_PASSWORD' as const,
      password: 'A personal passphrase!',
    };
    const actor = { id: 1, systemRoles: [], organizationId: null };
    expect(await useCase.execute(10, dto, actor)).toEqual({ id: 10 });
    expect(lifecycle.update).toHaveBeenCalledWith(10, dto, actor);
  });
});
