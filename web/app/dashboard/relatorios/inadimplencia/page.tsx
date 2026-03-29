'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { getUsuario } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AlertTriangle, Filter, Loader2 } from 'lucide-react';

const cls = 'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white';

export default function InadimplenciaPage() {
  const [dados, setDados] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);

  // Filtros
  const [usinas, setUsinas] = useState<any[]>([]);
  const [cooperativas, setCooperativas] = useState<any[]>([]);
  const [filtroUsina, setFiltroUsina] = useState('');
  const [filtroCooperativa, setFiltroCooperativa] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  useEffect(() => {
    api.get('/usinas').then((r) => setUsinas(r.data || [])).catch(() => {});
    const usuario = getUsuario() as any;
    if (usuario?.perfil === 'SUPER_ADMIN') {
      api.get('/cooperativas').then((r) => setCooperativas(r.data || [])).catch(() => {});
    } else if (usuario?.cooperativaId) {
      setCooperativas([{ id: usuario.cooperativaId, nome: usuario.cooperativaNome ?? 'Minha cooperativa' }]);
    }
  }, []);

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buscar() {
    setCarregando(true);
    const params = new URLSearchParams();
    if (filtroUsina) params.set('usinaId', filtroUsina);
    if (filtroCooperativa) params.set('cooperativaId', filtroCooperativa);
    if (filtroTipo) params.set('tipoCooperado', filtroTipo);
    api.get(`/relatorios/inadimplencia?${params.toString()}`)
      .then((r) => setDados(r.data))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle className="h-6 w-6 text-red-600" />
        <h2 className="text-2xl font-bold text-gray-800">Inadimplencia Estratificada</h2>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Usina</label>
              <select className={cls} value={filtroUsina} onChange={(e) => setFiltroUsina(e.target.value)}>
                <option value="">Todas</option>
                {usinas.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Parceiro</label>
              <select className={cls} value={filtroCooperativa} onChange={(e) => setFiltroCooperativa(e.target.value)}>
                <option value="">Todos</option>
                {cooperativas.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Tipo Cooperado</label>
              <select className={cls} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                <option value="">Todos</option>
                <option value="COM_UC">Com UC</option>
                <option value="SEM_UC">Sem UC</option>
                <option value="GERADOR">Gerador</option>
                <option value="CARREGADOR_VEICULAR">Carregador Veicular</option>
                <option value="USUARIO_CARREGADOR">Usuario Carregador</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={buscar} disabled={carregando} className="w-full">
                {carregando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Filtrar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {carregando && <p className="text-gray-500">Carregando...</p>}

      {dados && (
        <>
          {/* Resumo geral */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-red-600 font-medium">Total Inadimplente</p>
                <p className="text-3xl font-bold text-red-800">R$ {dados.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-gray-600 font-medium">Quantidade de Cobranças Vencidas</p>
                <p className="text-3xl font-bold text-gray-800">{dados.totalQtd}</p>
              </CardContent>
            </Card>
          </div>

          {/* Por Usina */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Por Usina</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usina</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Qtd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.porUsina.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-gray-400 py-4">Nenhum dado</TableCell></TableRow>
                  ) : (
                    dados.porUsina.map((u: any) => (
                      <TableRow key={u.usinaId}>
                        <TableCell className="font-medium">{u.usinaNome}</TableCell>
                        <TableCell>R$ {u.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>{u.qtd}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Por Tipo Cooperado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por Tipo de Cooperado</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Qtd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.porTipoCooperado.map((t: any) => (
                      <TableRow key={t.tipo}>
                        <TableCell className="font-medium">{t.tipo.replace(/_/g, ' ')}</TableCell>
                        <TableCell>R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>{t.qtd}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Por Faixa kWh */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por Faixa de kWh Contratado</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Faixa</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Qtd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.porFaixaKwh.map((f: any) => (
                      <TableRow key={f.faixa}>
                        <TableCell className="font-medium">{f.faixa} kWh</TableCell>
                        <TableCell>R$ {f.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>{f.qtd}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Top 10 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 10 Maiores Inadimplentes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Cobranças</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.top10Inadimplentes.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-4">Nenhum inadimplente</TableCell></TableRow>
                  ) : (
                    dados.top10Inadimplentes.map((c: any, i: number) => (
                      <TableRow key={c.cooperadoId}>
                        <TableCell className="font-bold text-gray-500">{i + 1}</TableCell>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell className="text-red-700 font-medium">R$ {c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>{c.qtdCobrancas}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
