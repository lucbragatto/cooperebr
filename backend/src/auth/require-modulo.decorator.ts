import { SetMetadata } from '@nestjs/common';

export const MODULO_KEY = 'modulo_requerido';
export const RequireModulo = (modulo: string) => SetMetadata(MODULO_KEY, modulo);
