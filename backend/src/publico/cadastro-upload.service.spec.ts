/**
 * Convergência convite custeio Fatia 1 (04/06/2026) — Specs do
 * CadastroUploadService.
 *
 * Cobre:
 *  1. Sem arquivo → BadRequest.
 *  2. Arquivo > 5MB → BadRequest.
 *  3. Mime não permitido (ex: text/plain) → BadRequest.
 *  4. Tipo inválido (não está na whitelist) → BadRequest.
 *  5. Token inválido (length ≠ 64) → BadRequest.
 *  6. Convite inexistente → NotFound.
 *  7. Convite usedAt → BadRequest.
 *  8. Convite expirado → BadRequest.
 *  9. Sem otpValidadoEm → BadRequest.
 * 10. OTP > 30min → BadRequest.
 * 11. Happy path → ref + publicUrl + bytes + mime.
 *
 * Não testa Supabase real — mock do storage client.
 */
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CadastroUploadService } from './cadastro-upload.service';

// Mock do supabase client criado dentro do construtor
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  }),
}));

describe('CadastroUploadService — Fatia 1', () => {
  const findUniqueConvite = jest.fn();
  const prisma: any = {
    conviteConvenioMembro: { findUnique: findUniqueConvite },
  };

  let service: CadastroUploadService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://x/y.jpg' } });
    mockUpload.mockResolvedValue({ error: null });
    process.env.SUPABASE_URL = 'http://x';
    process.env.SUPABASE_SERVICE_KEY = 'x';
    service = new CadastroUploadService(prisma);
  });

  const TOKEN_OK = 'a'.repeat(64);
  const arquivoOk = (size = 1024, mime = 'image/jpeg', name = 'rg.jpg') =>
    ({
      buffer: Buffer.from('x'.repeat(size)),
      size,
      mimetype: mime,
      originalname: name,
    }) as Express.Multer.File;

  const conviteVivo = () => ({
    id: 'conv-1',
    usedAt: null,
    expiresAt: new Date(Date.now() + 60000),
    otpValidadoEm: new Date(Date.now() - 5 * 60 * 1000), // 5min atrás
    cooperativaId: 'coop-A',
  });

  it('sem arquivo → BadRequest', async () => {
    await expect(
      service.uploadComConvite(TOKEN_OK, 'RG_FRENTE', undefined as any),
    ).rejects.toThrow(BadRequestException);
    expect(findUniqueConvite).not.toHaveBeenCalled();
  });

  it('arquivo > 5MB → BadRequest', async () => {
    await expect(
      service.uploadComConvite(TOKEN_OK, 'FATURA', arquivoOk(6 * 1024 * 1024)),
    ).rejects.toThrow(BadRequestException);
  });

  it('mime não permitido → BadRequest', async () => {
    await expect(
      service.uploadComConvite(TOKEN_OK, 'FATURA', arquivoOk(1024, 'text/plain', 'a.txt')),
    ).rejects.toThrow(BadRequestException);
  });

  it('tipo fora da whitelist → BadRequest', async () => {
    await expect(
      service.uploadComConvite(TOKEN_OK, 'PASSAPORTE', arquivoOk()),
    ).rejects.toThrow(BadRequestException);
  });

  it('token inválido (curto) → BadRequest', async () => {
    await expect(
      service.uploadComConvite('xx', 'RG_FRENTE', arquivoOk()),
    ).rejects.toThrow(BadRequestException);
    expect(findUniqueConvite).not.toHaveBeenCalled();
  });

  it('convite inexistente → NotFound', async () => {
    findUniqueConvite.mockResolvedValueOnce(null);
    await expect(
      service.uploadComConvite(TOKEN_OK, 'RG_FRENTE', arquivoOk()),
    ).rejects.toThrow(NotFoundException);
  });

  it('convite usedAt → BadRequest', async () => {
    findUniqueConvite.mockResolvedValueOnce({ ...conviteVivo(), usedAt: new Date() });
    await expect(
      service.uploadComConvite(TOKEN_OK, 'RG_FRENTE', arquivoOk()),
    ).rejects.toThrow(BadRequestException);
  });

  it('convite expirado → BadRequest', async () => {
    findUniqueConvite.mockResolvedValueOnce({
      ...conviteVivo(),
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(
      service.uploadComConvite(TOKEN_OK, 'RG_FRENTE', arquivoOk()),
    ).rejects.toThrow(BadRequestException);
  });

  it('sem otpValidadoEm → BadRequest (precisa validar OTP antes de upload)', async () => {
    findUniqueConvite.mockResolvedValueOnce({ ...conviteVivo(), otpValidadoEm: null });
    await expect(
      service.uploadComConvite(TOKEN_OK, 'RG_FRENTE', arquivoOk()),
    ).rejects.toThrow(BadRequestException);
  });

  it('OTP > 30min → BadRequest (sessão expirada)', async () => {
    findUniqueConvite.mockResolvedValueOnce({
      ...conviteVivo(),
      otpValidadoEm: new Date(Date.now() - 45 * 60 * 1000), // 45min atrás
    });
    await expect(
      service.uploadComConvite(TOKEN_OK, 'RG_FRENTE', arquivoOk()),
    ).rejects.toThrow(BadRequestException);
  });

  it('happy path → retorna ref + publicUrl + bytes + mime', async () => {
    findUniqueConvite.mockResolvedValueOnce(conviteVivo());

    const r = await service.uploadComConvite(TOKEN_OK, 'RG_FRENTE', arquivoOk());

    expect(r.ok).toBe(true);
    expect(r.tipo).toBe('RG_FRENTE');
    expect(r.ref).toMatch(/^tmp\/convite-uploads\/conv-1\/RG_FRENTE_\d+\.jpg$/);
    expect(r.publicUrl).toBe('https://x/y.jpg');
    expect(r.bytes).toBe(1024);
    expect(r.mime).toBe('image/jpeg');
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^tmp\/convite-uploads\/conv-1\/RG_FRENTE_/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/jpeg', upsert: true }),
    );
  });

  it('upload no Supabase falha (error não-null) → BadRequest', async () => {
    findUniqueConvite.mockResolvedValueOnce(conviteVivo());
    mockUpload.mockResolvedValueOnce({ error: { message: 'storage limit' } });

    await expect(
      service.uploadComConvite(TOKEN_OK, 'SELFIE', arquivoOk(2048, 'image/png', 'selfie.png')),
    ).rejects.toThrow(BadRequestException);
  });

  it('aceita SELFIE (tipo novo Fatia 1)', async () => {
    findUniqueConvite.mockResolvedValueOnce(conviteVivo());
    const r = await service.uploadComConvite(
      TOKEN_OK,
      'SELFIE',
      arquivoOk(2048, 'image/png', 'selfie.png'),
    );
    expect(r.tipo).toBe('SELFIE');
    expect(r.ref).toContain('SELFIE_');
  });

  it('aceita FATURA (PDF)', async () => {
    findUniqueConvite.mockResolvedValueOnce(conviteVivo());
    const r = await service.uploadComConvite(
      TOKEN_OK,
      'FATURA',
      arquivoOk(50000, 'application/pdf', 'fatura.pdf'),
    );
    expect(r.tipo).toBe('FATURA');
    expect(r.mime).toBe('application/pdf');
  });
});
