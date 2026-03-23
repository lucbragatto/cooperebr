import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { CooperativasService } from './cooperativas.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

@Controller('cooperativas')
export class CooperativasController {
  constructor(private readonly cooperativasService: CooperativasService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @Get()
  findAll() {
    return this.cooperativasService.findAll();
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cooperativasService.findOne(id);
  }

  @Roles(SUPER_ADMIN)
  @Post()
  create(
    @Body()
    body: {
      nome: string;
      cnpj: string;
      email?: string;
      telefone?: string;
      endereco?: string;
      numero?: string;
      bairro?: string;
      cidade?: string;
      estado?: string;
      cep?: string;
      ativo?: boolean;
    },
  ) {
    return this.cooperativasService.create(body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      nome?: string;
      cnpj?: string;
      email?: string;
      telefone?: string;
      endereco?: string;
      numero?: string;
      bairro?: string;
      cidade?: string;
      estado?: string;
      cep?: string;
      ativo?: boolean;
    },
  ) {
    return this.cooperativasService.update(id, body);
  }

  @Roles(SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cooperativasService.remove(id);
  }
}
