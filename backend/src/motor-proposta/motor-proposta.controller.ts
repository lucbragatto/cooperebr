import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { MotorPropostaService } from './motor-proposta.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import type { CalcularPropostaDto } from './dto/calcular-proposta.dto';
import type { ConfiguracaoMotorDto } from './dto/configuracao-motor.dto';
import type { TarifaConcessionariaDto } from './dto/tarifa-concessionaria.dto';
import type { SimularReajusteDto } from './dto/simular-reajuste.dto';

const { ADMIN, OPERADOR } = PerfilUsuario;

@Controller('motor-proposta')
@Roles(ADMIN, OPERADOR)
export class MotorPropostaController {
  constructor(private readonly service: MotorPropostaService) {}

  @Get()
  dashboard() {
    return this.service.dashboardStats();
  }

  @Post('calcular')
  calcular(@Body() dto: CalcularPropostaDto) {
    return this.service.calcular(dto);
  }

  @Post('confirmar-opcao')
  confirmarOpcao(@Body() dto: CalcularPropostaDto) {
    return this.service.confirmarOpcao(dto);
  }

  @Post('aceitar')
  aceitar(@Body() body: any) {
    return this.service.aceitar(body);
  }

  @Roles(ADMIN)
  @Get('configuracao')
  getConfiguracao() {
    return this.service.getConfiguracao();
  }

  @Roles(ADMIN)
  @Put('configuracao')
  updateConfiguracao(@Body() dto: ConfiguracaoMotorDto) {
    return this.service.updateConfiguracao(dto);
  }

  @Get('historico/:cooperadoId')
  historico(@Param('cooperadoId') cooperadoId: string) {
    return this.service.historico(cooperadoId);
  }

  @Post('tarifa-concessionaria')
  criarTarifa(@Body() dto: TarifaConcessionariaDto) {
    return this.service.criarTarifa(dto);
  }

  @Get('tarifa-concessionaria/atual')
  tarifaAtual() {
    return this.service.tarifaAtual();
  }

  @Get('tarifa-concessionaria')
  listarTarifas() {
    return this.service.listarTarifas();
  }

  @Get('historico-reajustes')
  historicoReajustes() {
    return this.service.historicoReajustes();
  }

  @Post('simular-reajuste')
  simularReajuste(@Body() dto: SimularReajusteDto) {
    return this.service.simularReajuste(dto);
  }

  @Post('aplicar-reajuste')
  aplicarReajuste(@Body() dto: SimularReajusteDto) {
    return this.service.aplicarReajuste(dto);
  }
}
