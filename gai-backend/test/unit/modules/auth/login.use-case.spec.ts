import { UnauthorizedException } from '@nestjs/common';
import { LoginUseCase } from '../../../../src/modules/auth/application/use-cases/login.use-case';
describe('LoginUseCase transactional facade', () => {
  it('propagates credential rejection without resolving grants', async () => {
    const credentials = {
      authenticate: jest.fn().mockRejectedValue(new UnauthorizedException()),
    };
    const assignments = { findActiveByUserId: jest.fn() };
    const useCase = new LoginUseCase(
      credentials as never,
      assignments as never,
      {} as never,
    );
    await expect(
      useCase.execute({ identifier: 'person', password: 'invalid' }, null),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(assignments.findActiveByUserId).not.toHaveBeenCalled();
  });
});
