import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface SungrowConfig {
  sungrowUsuario: string;
  sungrowSenha: string;
  sungrowAppKey: string;
  sungrowPlantId: string;
}

export interface UsinaStatus {
  online: boolean;
  potenciaKw: number | null;
  energiaHojeKwh: number | null;
  energiaMesKwh: number | null;
  energiaTotalKwh: number | null;
  rawData?: any;
}

@Injectable()
export class SungrowService {
  private readonly logger = new Logger(SungrowService.name);
  private readonly baseUrl = 'https://gateway.isolarcloud.com.hk/openapi';
  private tokenCache = new Map<string, { token: string; expiresAt: number }>();

  constructor(private readonly httpService: HttpService) {}

  async login(usuario: string, senha: string, appKey: string): Promise<string | null> {
    try {
      const cacheKey = `${usuario}:${appKey}`;
      const cached = this.tokenCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
      }

      const { data } = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/login`, {
          user_account: usuario,
          user_password: senha,
        }, {
          headers: {
            'Content-Type': 'application/json',
            sys_code: '901',
            'x-access-key': appKey,
          },
        }),
      );

      if (data?.result_code === '1' && data?.result_data?.token) {
        const token = data.result_data.token;
        this.tokenCache.set(cacheKey, {
          token,
          expiresAt: Date.now() + 3600 * 1000,
        });
        return token;
      }

      this.logger.warn(`Sungrow login falhou: ${data?.result_msg || 'resposta inesperada'}`);
      return null;
    } catch (error) {
      this.logger.error(`Erro no login Sungrow: ${error.message}`);
      return null;
    }
  }

  async getUsinaStatus(config: SungrowConfig): Promise<UsinaStatus | null> {
    try {
      const token = await this.login(
        config.sungrowUsuario,
        config.sungrowSenha,
        config.sungrowAppKey,
      );
      if (!token) return null;

      const headers = {
        'Content-Type': 'application/json',
        sys_code: '901',
        'x-access-key': config.sungrowAppKey,
        token,
      };

      const { data } = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/getPowerStationDetail`, {
          ps_id: config.sungrowPlantId,
        }, { headers }),
      );

      if (data?.result_code !== '1' || !data?.result_data) {
        this.logger.warn(`Sungrow status falhou: ${data?.result_msg || 'sem dados'}`);
        return null;
      }

      const plant = data.result_data;
      const potenciaKw = parseFloat(plant.curr_power) || 0;

      return {
        online: potenciaKw > 0,
        potenciaKw,
        energiaHojeKwh: parseFloat(plant.today_energy) || null,
        energiaMesKwh: parseFloat(plant.month_energy) || null,
        energiaTotalKwh: parseFloat(plant.total_energy) || null,
        rawData: plant,
      };
    } catch (error) {
      this.logger.error(`Erro ao obter status Sungrow: ${error.message}`);
      return null;
    }
  }
}
