import { IsCivilDate } from '../../common/validation/civil-date';
import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ANSWER_STATES,
  type AnswerState,
  PREPARATION_KINDS,
  type PreparationKind,
  type PreparationValue,
  QUESTION_TYPES,
  type QuestionCondition,
  type QuestionType,
  type Scalar,
} from './domain/preparation.types';

export class ConditionDto implements QuestionCondition {
  @ApiProperty() @IsString() @MaxLength(80) question_id!: string;
  @ApiProperty({ enum: ['equals', 'not_equals', 'in', 'answered'] })
  @IsIn(['equals', 'not_equals', 'in', 'answered'])
  operator!: QuestionCondition['operator'];
  @ApiPropertyOptional() @Allow() value?: Scalar | Scalar[];
}
export class QuestionDto {
  @ApiProperty() @Matches(/^[a-z][a-z0-9_-]{1,79}$/) id!: string;
  @ApiProperty() @IsString() @MaxLength(100) category!: string;
  @ApiProperty() @IsString() @MaxLength(500) label!: string;
  @ApiProperty({ enum: QUESTION_TYPES })
  @IsIn(QUESTION_TYPES)
  type!: QuestionType;
  @ApiProperty() @IsInt() @Min(0) @Max(10000) order!: number;
  @ApiProperty() @IsBoolean() required!: boolean;
  @ApiProperty() @IsBoolean() visible!: boolean;
  @ApiProperty() @IsBoolean() allow_not_applicable!: boolean;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  options?: string[];
  @ApiPropertyOptional({ type: [ConditionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  enabled_when?: ConditionDto[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  quantity_question_id?: string;
}
export class TemplateContentDto {
  @ApiProperty() @IsString() @MaxLength(200) name!: string;
  @ApiProperty({ type: [QuestionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(120)
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions!: QuestionDto[];
}
export class CreateTemplateDto extends TemplateContentDto {
  @ApiProperty({ enum: PREPARATION_KINDS })
  @IsIn(PREPARATION_KINDS)
  kind!: PreparationKind;
}
export class UpdateTemplateDto extends TemplateContentDto {
  @ApiProperty() @IsInt() @Min(1) expected_version!: number;
}
export class RevisionDto {
  @ApiProperty() @IsInt() @Min(1) revision!: number;
}
export class CreatePreparationDto {
  @ApiProperty() @IsInt() @Min(1) template_id!: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  template_version?: number;
  @ApiProperty() @IsString() @MaxLength(200) title!: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  responsible_user_id?: number | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsCivilDate()
  scheduled_date?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsCivilDate()
  due_date?: string | null;
}
export class UpdatePreparationDto extends RevisionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  responsible_user_id?: number | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsCivilDate()
  scheduled_date?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsCivilDate()
  due_date?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string | null;
}
export class AnswerDto {
  @ApiProperty() @IsString() @MaxLength(80) question_id!: string;
  @ApiProperty({ enum: ANSWER_STATES })
  @IsIn(ANSWER_STATES)
  state!: AnswerState;
  @ApiProperty({
    nullable: true,
    description:
      'Typed value defined by the immutable question snapshot; pending and not_applicable require null',
  })
  @Allow()
  value!: PreparationValue;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  responsible_user_id?: number | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsCivilDate()
  due_date?: string | null;
}
export class SaveAnswersDto extends RevisionDto {
  @ApiProperty({ type: [AnswerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(120)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];
}
export class HistoryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  before_id?: number;
}
export class CommunicationQueryDto {
  @ApiPropertyOptional({ enum: ['email', 'guidance'], default: 'email' })
  @IsOptional()
  @IsIn(['email', 'guidance'])
  channel: 'email' | 'guidance' = 'email';
}
