import { Injectable } from '@nestjs/common';
import { UserLifecycleService } from '../services/user-lifecycle.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { ActorContext } from '../services/user-scope.service';
@Injectable()
export class CreateUserUseCase {
  constructor(private readonly lifecycle: UserLifecycleService) {}
  execute(dto: CreateUserDto, actor: ActorContext) {
    return this.lifecycle.create(dto, actor);
  }
}
