import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  FieldDefinition,
  FieldTaskDefinition,
  Priority,
  TaskState,
} from './field.policy';
import { TASK_STATES } from './field.policy';
export class FieldPageQuery {
  @ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size = 20;
  @IsOptional() @IsString() @MaxLength(80) group_id?: string;
  @IsOptional() @IsIn(TASK_STATES) state?: TaskState;
  @IsOptional() @IsIn(['low', 'normal', 'high', 'urgent']) priority?: Priority;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  responsible_user_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) field_agent_id?: number;
  @IsOptional() @IsIn(['true', 'false']) overdue?: string;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) due_before?: string;
  @IsOptional() @IsIn(['user', 'field_agent']) kind?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) before_id?: number;
}
export class FieldTemplateDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(200) name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;
  @ApiProperty({ type: Object }) @IsObject() definition!: FieldDefinition;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  expected_version?: number;
}
export class FieldRevisionDto {
  @ApiProperty() @IsInt() @Min(1) revision!: number;
}
export class FieldApprovalDto extends FieldRevisionDto {
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(80) command_key!: string;
}
export class FieldCreateDto {
  @ApiProperty() @IsInt() @Min(1) template_id!: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  template_version?: number;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(80) command_key!: string;
}
export class FieldTransitionDto extends FieldRevisionDto {
  @ApiProperty() @IsIn(['complete', 'reopen', 'archive']) action!:
    | 'complete'
    | 'reopen'
    | 'archive';
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(80) command_key!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  reason?: string;
}
export class FieldTaskDto extends FieldRevisionDto {
  @ApiPropertyOptional() @IsOptional() @IsIn(TASK_STATES) state?: TaskState;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: Priority;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) notes?:
    | string
    | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) reason?:
    | string
    | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) responsible_user_id?:
    | number
    | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) field_agent_id?:
    | number
    | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) linked_issue_id?:
    | number
    | null;
  @ApiPropertyOptional() @IsOptional() @IsString() start_date?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() due_date?: string | null;
}
export class FieldAddTaskDto extends FieldTaskDto {
  @ApiProperty({ type: Object }) @IsObject() definition!: FieldTaskDefinition;
}
export class FieldMessageQuery {
  @ApiProperty()
  @IsIn(['initial', 'assigned', 'pending', 'open', 'inventory_start'])
  kind!: string;
  @IsOptional() @IsString() @MaxLength(80) group_id?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  responsible_user_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) field_agent_id?: number;
}
// API reports dates, state and author; no client-provided completion timestamp or approval flag.
export class FieldArchiveTemplateDto {
  @IsInt() @Min(1) expected_version!: number;
  @IsBoolean() archived!: boolean;
}
