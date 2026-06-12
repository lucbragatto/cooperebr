# EXFISHES Parser v1 — WIP (parado em 11/06/2026 noite)
#
# STATUS: parser inicial funcionando MAS com 3 bugs identificados:
#  1. Valor TOTAL vem truncado (perde casas decimais — ex 18730 em vez de 18730.78)
#  2. TUSD/TE injetadas as vezes capturam "200,00" (que é contribuicao ilum publica)
#  3. Alguns indebitos vieram NEGATIVOS (impossivel — bug de captura de base)
#
# CONTEXTO:
#  - 14 faturas EXFISHES unicas em Downloads (gaps MAR/2025 e MAI/2025)
#  - Triplicatas confirmadas por MD5 — #2/#14/MARCO COOPEREBR 1 = mesmo arquivo MAR/2026
#  - Triplicata ABR/2026 — #15 / ABRIL COOPEREBR 2 / exfishes gdIII
#
# ACHADO CRITICO: a FEV/2025 (1a fatura da serie) JA mostra SCEE ativo com
# 53.574 kWh injetados ref. 01/2025. Logo, a "transicao GDIII em mar/2026"
# que esta no mockup esta INCORRETA. EXFISHES ja estava no SCEE desde
# pelo menos out/2024 (inferido pelo historico de 13 meses na pg 2).
#
# PROXIMO PASSO (amanha):
#  1. Refinar regex pros 3 campos com bug
#  2. Calibrar com ABR/2026 conhecido (mockup diz R$ 2.515,24 indebito)
#  3. Rodar nas 14 faturas
#  4. Corrigir narrativa "transicao mar/2026" do mockup

import pdfplumber, re, json
from pathlib import Path

faturas = [
    ("FEV/2025", "EXFISHES _ 1 _ FEV2025.pdf"),
    ("ABR/2025", "EXFISHES _ 3 _ ABR2025.pdf"),
    ("JUN/2025", "EXFISHES _ 5 _ JUN2025.pdf"),
    ("JUL/2025", "EXFISHES _ 6 _ JUL2025.pdf"),
    ("AGO/2025", "EXFISHES _ 7 _ AGO2025.pdf"),
    ("SET/2025", "EXFISHES _ 8 _ SET2025.pdf"),
    ("OUT/2025", "EXFISHES _ 9 _ OUT2025.pdf"),
    ("NOV/2025", "EXFISHES _ 10 _ NOV2025.pdf"),
    ("DEZ/2025", "EXFISHES _ 11 _ DEZ2025.pdf"),
    ("JAN/2026", "EXFISHES _ 12 _ JAN2026.pdf"),
    ("FEV/2026", "EXFISHES _ 13 _ FEV2026.pdf"),
    ("MAR/2026", "EXFISHES _ 14 _ MAR2026.pdf"),
    ("ABR/2026", "EXFISHES _ 15 _ ABR2026.pdf"),
    ("MAI/2026", "EXFISHES _ 16 _ MAI2026.pdf"),
]

def br_float(s):
    if s is None: return 0.0
    s = s.replace(' ', '').replace('.', '').replace(',', '.')
    try: return float(s)
    except: return 0.0

# TODO amanha: implementar parser robusto que:
#  - captura TOTAL completo com decimais (regex deve aceitar 18.730,78)
#  - identifica TUSD/TE injetada pela tag oUC oPT NN/YYYY na MESMA linha
#  - pega base PIS especifica (51666,12) sem confundir com base COFINS (mesma)
#  - valida que indebito >= 0 SEMPRE (se < 0, marca erro de captura)
