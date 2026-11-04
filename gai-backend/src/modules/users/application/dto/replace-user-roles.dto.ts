import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReplaceUserRolesDto {
  @ApiProperty({
    type: [Number],
    description: 'Conjunto completo de perfis desejados; substituição atômica.',
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  role_ids!: number[];
}
