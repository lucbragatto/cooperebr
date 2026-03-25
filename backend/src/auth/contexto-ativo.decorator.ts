import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type TipoContexto =
  | 'super_admin'
  | 'admin_parceiro'
  | 'cooperado'
  | 'proprietario_usina';

export const ContextoAtivo = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TipoContexto | null => {
    const request = ctx.switchToHttp().getRequest();
    const header = request.headers['x-contexto-ativo'];
    if (
      header === 'super_admin' ||
      header === 'admin_parceiro' ||
      header === 'cooperado' ||
      header === 'proprietario_usina'
    ) {
      return header;
    }
    return null;
  },
);
