/**
 * A situação do projeto não permite a operação. Quem captura decide pelo tipo
 * (ou pelo `code`), nunca pelo texto da mensagem.
 */
export class ProjectStatusBlocksOperationError extends Error {
  readonly code = 'PROJECT_STATUS_BLOCKS_OPERATION';

  constructor() {
    super('A situação do projeto não permite esta operação.');
    this.name = ProjectStatusBlocksOperationError.name;
  }
}
