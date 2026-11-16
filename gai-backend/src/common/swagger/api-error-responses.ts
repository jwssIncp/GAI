import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorCode } from './error-code.enum';
import { ErrorResponseDto } from './error-response.dto';

export function ApiUnauthorizedResponse() {
  return ApiResponse({
    status: 401,
    description: 'Token ausente, expirado ou sessão inválida',
    type: ErrorResponseDto,
    example: { code: ErrorCode.UNAUTHORIZED, message: 'Não autenticado.' },
  });
}

export function ApiForbiddenResponse() {
  return ApiResponse({
    status: 403,
    description: 'Autenticado, mas sem permissao efetiva ou escopo suficiente',
    type: ErrorResponseDto,
    example: {
      code: ErrorCode.FORBIDDEN,
      message: 'Você não tem permissão para esta ação.',
    },
  });
}

export function ApiNotFoundResponse(description = 'Recurso não encontrado') {
  return ApiResponse({
    status: 404,
    description,
    type: ErrorResponseDto,
    example: {
      code: ErrorCode.NOT_FOUND,
      message: 'Organização não encontrada.',
    },
  });
}

export function ApiValidationErrorResponse() {
  return ApiResponse({
    status: 400,
    description: 'Dados de entrada inválidos',
    type: ErrorResponseDto,
    example: {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Dados inválidos.',
      details: [
        { field: 'cnpj', message: 'CNPJ com dígitos verificadores inválidos.' },
      ],
    },
  });
}

export function ApiConflictResponse(description: string, message: string) {
  return ApiResponse({
    status: 409,
    description,
    type: ErrorResponseDto,
    example: { code: ErrorCode.CONFLICT, message },
  });
}

export function ApiOrganizationMutationResponses() {
  return applyDecorators(
    ApiUnauthorizedResponse(),
    ApiForbiddenResponse(),
    ApiNotFoundResponse('Organization não encontrada'),
  );
}

export function ApiAccountLockedResponse() {
  return ApiResponse({
    status: 423,
    description: 'Conta bloqueada temporariamente por tentativas de login',
    type: ErrorResponseDto,
    example: {
      code: ErrorCode.ACCOUNT_LOCKED,
      message:
        'Conta bloqueada temporariamente após tentativas de acesso sem sucesso.',
    },
  });
}
