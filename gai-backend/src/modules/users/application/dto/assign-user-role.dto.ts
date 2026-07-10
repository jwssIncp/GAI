import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class AssignUserRoleDto {
  @ApiProperty({ type: 'integer', format: 'int64' })
  @IsInt()
  @Min(1)
  role_id!: number;
}
