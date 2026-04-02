#!/usr/bin/env python3
"""Apply 3 improvements to whatsapp-bot.service.ts"""
import sys

with open('src/whatsapp/whatsapp-bot.service.ts', 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

content = ''.join(lines)

# Helper: extract block from file by line range (0-indexed)
def get_block(start, end):
    return ''.join(lines[start:end])

# ============ MELHORIA 1 + 2 ============
# Replace lines 107-124 (0-indexed: 106-123)
old1 = get_block(106, 124)
print(f"Block 1 found, {len(old1)} chars")

# Keep original line 111 (cancelar msg) and line 121 (ajuda msg) exact
cancel_line = lines[110]  # line 111
ajuda_line = lines[120]   # line 121

new1 = (
    "    // Fallback: palavras-chave especiais\n"
    "    const corpoLower = corpo.toLowerCase();\n"
    "\n"
    "    // ——— Navegação global: voltar / sair ———\n"
    "    if (conversa.estado !== 'INICIAL' && conversa.estado !== 'CONCLUIDO') {\n"
    "      if (['menu', 'voltar', '0', 'inicio', 'início'].includes(corpoLower)) {\n"
    "        await this.resetarConversa(telefone);\n"
    "        await this.handleMenuPrincipalInicio(msg, { ...conversa, estado: 'INICIAL' });\n"
    "        return;\n"
    "      }\n"
    "      if (['sair', 'cancelar', 'tchau', 'ate logo', 'encerrar', 'parar'].includes(corpoLower)) {\n"
    "        await this.prisma.conversaWhatsapp.update({\n"
    "          where: { id: conversa.id },\n"
    "          data: { estado: 'CONCLUIDO', contadorFallback: 0 },\n"
    "        });\n"
    "        await this.sender.enviarMensagem(telefone, 'Tudo bem! 😊 Se precisar de mim, é só chamar. Até logo!');\n"
    "        return;\n"
    "      }\n"
    "    }\n"
    "\n"
    "    // ——— Retorno simpático: saudação em estado intermediário ———\n"
    "    if (\n"
    "      conversa.estado !== 'INICIAL' &&\n"
    "      conversa.estado !== 'CONCLUIDO' &&\n"
    "      conversa.estado !== 'RETORNO_SAUDACAO' &&\n"
    "      ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'hi'].includes(corpoLower)\n"
    "    ) {\n"
    "      await this.prisma.conversaWhatsapp.update({\n"
    "        where: { id: conversa.id },\n"
    "        data: {\n"
    "          estado: 'RETORNO_SAUDACAO',\n"
    "          dadosTemp: { ...(conversa.dadosTemp as any ?? {}), estadoAnterior: conversa.estado } as any,\n"
    "        },\n"
    "      });\n"
    "      await this.sender.enviarMensagem(\n"
    "        telefone,\n"
    "        'Olá! Que bom ter você aqui de novo! 😊\\n\\nVocê estava no meio de um processo. O que prefere?\\n\\n1️⃣ Continuar de onde parei\\n2️⃣ Recomeçar do zero',\n"
    "      );\n"
    "      return;\n"
    "    }\n"
    "\n"
    "    if (['cancelar', 'cancel'].includes(corpoLower)) {\n"
    "      await this.resetarConversa(telefone);\n"
    + cancel_line +
    "      await this.sender.enviarMensagem(telefone, texto);\n"
    "      return;\n"
    "    }\n"
    "\n"
    "    if (['ajuda', 'duvida', 'dúvida', 'problema', 'erro', 'help', 'menu'].includes(corpoLower)) {\n"
    "      if (corpoLower === 'menu' || corpoLower === 'ajuda' || corpoLower === 'help') {\n"
    "        await this.handleMenuPrincipalInicio(msg, conversa);\n"
    "        return;\n"
    "      }\n"
    + ajuda_line +
    "      await this.sender.enviarMensagem(telefone, texto);\n"
    "      return;\n"
    "    }"
)

content = content.replace(old1, new1, 1)
print("MELHORIA 1+2: Navegação global + retorno simpático applied")

# ============ Add switch cases ============
old2 = "        default:\n          await this.handleMenuPrincipalInicio(msg, conversa);"
new2 = (
    "        case 'RETORNO_SAUDACAO':\n"
    "          await this.handleRetornoSaudacao(msg, conversa);\n"
    "          break;\n"
    "        case 'AGUARDANDO_CORRECAO_DADOS':\n"
    "          await this.handleCorrecaoDados(msg, conversa);\n"
    "          break;\n"
    "        default:\n"
    "          await this.handleMenuPrincipalInicio(msg, conversa);"
)
assert old2 in content, "default case not found"
content = content.replace(old2, new2, 1)
print("Switch cases added")

# ============ MELHORIA 3: Handle 'não' in handleConfirmacaoDados ============
# Find the exact "Não entendeu" block using content search
marker = "    // Não entendeu\n"
idx = content.find(marker)
assert idx >= 0, "Não entendeu marker not found"

# Find end of the method (closing brace "  }")
end_marker = "\n  }"
end_idx = content.find(end_marker, idx)
assert end_idx >= 0, "Method end not found"

old3 = content[idx:end_idx + len(end_marker)]
print(f"Block 3 found at {idx}, length {len(old3)}")

new3 = (
    "    // Resposta negativa: dados incorretos\n"
    "    const corpoLower = corpo.toLowerCase();\n"
    "    if (['nao', 'não', 'errado', 'incorreto', 'errada', 'n'].includes(corpoLower)) {\n"
    "      await this.prisma.conversaWhatsapp.update({\n"
    "        where: { id: conversa.id },\n"
    "        data: { estado: 'AGUARDANDO_CORRECAO_DADOS' },\n"
    "      });\n"
    "      await this.sender.enviarMensagem(\n"
    "        telefone,\n"
    "        'Sem problema! O que precisa corrigir?\\n\\n1️⃣ Nome do titular\\n2️⃣ Endereço\\n3️⃣ Consumo ou valor da fatura\\n4️⃣ Outro\\n\\nOu corrija direto no formato:\\n_02/26 350 kWh R$ 287,50_',\n"
    "      );\n"
    "      return;\n"
    "    }\n"
    "\n"
    + old3
)

content = content.replace(old3, new3, 1)
print("MELHORIA 3: handle não applied")

# ============ Add new handler methods ============
old4 = "  private async resetarConversa(telefone: string): Promise<void> {"
new4 = (
    "  // ——— RETORNO_SAUDACAO: continuar ou recomeçar ———\n"
    "\n"
    "  private async handleRetornoSaudacao(msg: MensagemRecebida, conversa: any): Promise<void> {\n"
    "    const { telefone } = msg;\n"
    "    const corpo = this.respostaEfetiva(msg);\n"
    "    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;\n"
    "    const estadoAnterior = String(dadosTemp.estadoAnterior ?? 'INICIAL');\n"
    "\n"
    "    if (corpo === '1') {\n"
    "      await this.prisma.conversaWhatsapp.update({\n"
    "        where: { id: conversa.id },\n"
    "        data: { estado: estadoAnterior },\n"
    "      });\n"
    "      await this.sender.enviarMensagem(telefone, 'Ok! Vamos continuar de onde paramos. 😊');\n"
    "      return;\n"
    "    }\n"
    "\n"
    "    if (corpo === '2') {\n"
    "      await this.resetarConversa(telefone);\n"
    "      await this.handleMenuPrincipalInicio(msg, { ...conversa, estado: 'INICIAL' });\n"
    "      return;\n"
    "    }\n"
    "\n"
    "    await this.sender.enviarMensagem(\n"
    "      telefone,\n"
    "      'Por favor, escolha uma opção:\\n\\n1️⃣ Continuar de onde parei\\n2️⃣ Recomeçar do zero',\n"
    "    );\n"
    "  }\n"
    "\n"
    "  // ——— AGUARDANDO_CORRECAO_DADOS: correção genérica ———\n"
    "\n"
    "  private async handleCorrecaoDados(msg: MensagemRecebida, conversa: any): Promise<void> {\n"
    "    const { telefone } = msg;\n"
    "    const corpo = (msg.corpo ?? '').trim();\n"
    "    const dadosTemp = (conversa.dadosTemp ?? {}) as Record<string, unknown>;\n"
    "\n"
    "    // Tenta corrigir histórico via regex (mesmo formato do handleConfirmacaoDados)\n"
    "    const regexCorrecao = /^(\\d{2})[\\/\\-](\\d{2,4})\\s+(\\d+)\\s*kwh\\s+R?\\$?\\s*([\\d.,]+)/i;\n"
    "    const match = corpo.match(regexCorrecao);\n"
    "\n"
    "    if (match) {\n"
    "      const [, mes, ano, kwhStr, valorStr] = match;\n"
    "      const anoCompleto = ano.length === 2 ? `20${ano}` : ano;\n"
    "      const mesAno = `${mes}/${anoCompleto}`;\n"
    "      const kwh = parseInt(kwhStr);\n"
    "      const valor = parseFloat(valorStr.replace('.', '').replace(',', '.'));\n"
    "\n"
    "      const historico = (dadosTemp.historicoConsumo as Array<{ mesAno: string; consumoKwh: number; valorRS: number }>) ?? [];\n"
    "      const idx = historico.findIndex(h => h.mesAno === mesAno || h.mesAno === `${mes}/${ano}`);\n"
    "      if (idx >= 0) {\n"
    "        historico[idx] = { mesAno, consumoKwh: kwh, valorRS: valor };\n"
    "      } else {\n"
    "        historico.push({ mesAno, consumoKwh: kwh, valorRS: valor });\n"
    "      }\n"
    "\n"
    "      await this.prisma.conversaWhatsapp.update({\n"
    "        where: { id: conversa.id },\n"
    "        data: {\n"
    "          estado: 'AGUARDANDO_CONFIRMACAO_DADOS',\n"
    "          dadosTemp: { ...dadosTemp, historicoConsumo: historico } as any,\n"
    "        },\n"
    "      });\n"
    "\n"
    "      await this.sender.enviarMensagem(\n"
    "        telefone,\n"
    "        `✅ Mês ${mesAno} atualizado: ${kwh} kWh – R$ ${valor.toFixed(2).replace('.', ',')}\\n\\nOutro dado a corrigir? Ou responda *OK* para gerar a simulação.`,\n"
    "      );\n"
    "      return;\n"
    "    }\n"
    "\n"
    "    // Opções numéricas: resposta genérica\n"
    "    if (['1', '2', '3', '4'].includes(corpo)) {\n"
    "      await this.sender.enviarMensagem(\n"
    "        telefone,\n"
    "        'Certo! Envie a informação correta e eu atualizo para você.\\n\\nPara consumo/valor, use o formato:\\n_02/26 350 kWh R$ 287,50_',\n"
    "      );\n"
    "      return;\n"
    "    }\n"
    "\n"
    "    // Texto livre: salvar como observação e voltar para confirmação\n"
    "    await this.prisma.conversaWhatsapp.update({\n"
    "      where: { id: conversa.id },\n"
    "      data: {\n"
    "        estado: 'AGUARDANDO_CONFIRMACAO_DADOS',\n"
    "        dadosTemp: { ...dadosTemp, observacaoCorrecao: corpo } as any,\n"
    "      },\n"
    "    });\n"
    "\n"
    "    await this.sender.enviarMensagem(\n"
    "      telefone,\n"
    '      `📝 Anotado: "${corpo}"\\n\\nNossa equipe vai revisar. Por ora, responda *OK* para gerar a simulação com os dados atuais, ou corrija mais dados no formato:\\n_02/26 350 kWh R$ 287,50_`,\n'
    "    );\n"
    "  }\n"
    "\n"
    "  private async resetarConversa(telefone: string): Promise<void> {"
)

assert old4 in content, "resetarConversa not found"
content = content.replace(old4, new4, 1)
print("New handler methods added")

# Write back with BOM
with open('src/whatsapp/whatsapp-bot.service.ts', 'w', encoding='utf-8-sig') as f:
    f.write(content)

print("\n✅ All 3 improvements applied successfully!")
