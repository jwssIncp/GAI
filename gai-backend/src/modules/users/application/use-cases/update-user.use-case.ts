import { Injectable } from '@nestjs/common';
import { UserLifecycleService } from '../services/user-lifecycle.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ActorContext } from '../services/user-scope.service';
@Injectable()
export class UpdateUserUseCase {
  constructor(private readonly lifecycle: UserLifecycleService) {}
  execute(id: number, dto: UpdateUserDto, actor: ActorContext) {
    return this.lifecycle.update(id, dto, actor);
  }
}
