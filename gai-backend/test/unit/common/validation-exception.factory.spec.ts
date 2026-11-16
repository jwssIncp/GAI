import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  validate,
} from 'class-validator';
import { IsCivilDate } from '../../../src/common/validation/civil-date';
import {
  createValidationPipe,
  flattenValidationErrors,
  validationExceptionFactory,
} from '../../../src/common/validation/validation-exception.factory';

enum Color {
  RED = 'red',
  BLUE = 'blue',
}

class ChildDto {
  @IsString() name!: unknown;
}

class SampleDto {
  @IsString() text!: unknown;
  @IsInt() @Min(1) @Max(10) count!: unknown;
  @IsBoolean() flag!: unknown;
  @IsEmail() email!: unknown;
  @IsEnum(Color) color!: unknown;
  @IsIn(['a', 'b']) letter!: unknown;
  @MinLength(3) short!: unknown;
  @MaxLength(2) long!: unknown;
  @Length(2, 4) sized!: unknown;
  @Matches(/^\d+$/) digits!: unknown;
  @Matches(/^x$/, { message: 'Mensagem própria.' }) custom!: unknown;
  @IsArray() @ArrayMinSize(2) few!: unknown;
  @ArrayMaxSize(1) @ArrayUnique() many!: unknown;
  @IsString({ each: true }) tags!: unknown;
  @IsCivilDate() day!: unknown;
  @ValidateNested() @Type(() => ChildDto) child!: unknown;
}

async function messagesFor(input: Record<string, unknown>) {
  const dto = Object.assign(new SampleDto(), input);
  if (input.child) dto.child = Object.assign(new ChildDto(), input.child);
  return flattenValidationErrors(await validate(dto));
}

describe('validationExceptionFactory', () => {
  it('traduz as mensagens padrão do class-validator para pt-BR, com o campo', async () => {
    const messages = await messagesFor({
      text: 1,
      count: 20,
      flag: 'x',
      email: 'nope',
      color: 'green',
      letter: 'z',
      short: 'ab',
      long: 'abc',
      sized: 'a',
      digits: 'x',
      custom: 'y',
      few: [1],
      many: [1, 1],
      tags: [1],
      day: '2024-02-30',
      child: { name: 2 },
    });

    expect(messages).toEqual(
      expect.arrayContaining([
        'text: deve ser texto',
        'count: não pode ser maior que 10',
        'flag: deve ser verdadeiro ou falso',
        'email: deve ser um e-mail válido',
        'color: deve ser um destes valores: red, blue',
        'letter: deve ser um destes valores: a, b',
        'short: deve ter pelo menos 3 caracteres',
        'long: deve ter no máximo 2 caracteres',
        'sized: deve ter pelo menos 2 caracteres',
        'digits: está em formato inválido',
        'Mensagem própria.',
        'few: deve ter pelo menos 2 item(ns)',
        'many: deve ter no máximo 1 item(ns)',
        'many: não pode ter itens repetidos',
        'tags: cada item deve ser texto',
        'day: deve ser uma data válida no formato AAAA-MM-DD',
        'child.name: deve ser texto',
      ]),
    );
    expect(messages.some((message) => /must|should/.test(message))).toBe(false);
  });

  it('traduz número inteiro e mínimo', async () => {
    const messages = await messagesFor({ count: 0.5 });
    expect(messages).toEqual(
      expect.arrayContaining([
        'count: deve ser um número inteiro',
        'count: não pode ser menor que 1',
      ]),
    );
  });

  it('mantém o formato da resposta 400 (mensagens em lista, sem code próprio)', async () => {
    const errors = await validate(Object.assign(new ChildDto(), { name: 1 }));
    const exception = validationExceptionFactory(errors);
    expect(exception).toBeInstanceOf(BadRequestException);
    const body = exception.getResponse() as Record<string, unknown>;
    expect(body.message).toEqual(['name: deve ser texto']);
    expect(body.code).toBeUndefined();
  });

  it('traduz campos não permitidos pelo whitelist do pipe global', async () => {
    const pipe = createValidationPipe();
    await expect(
      pipe.transform(
        { name: 'ok', extra: 1 },
        { type: 'body', metatype: ChildDto },
      ),
    ).rejects.toMatchObject({
      response: { message: ['extra: campo não permitido'] },
    });
  });
});
