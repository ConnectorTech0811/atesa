import { pool } from '../config/database.js';

export async function obterParametrosPorTrabalho(trabalhoId) {
  const [linhas] = await pool.query(
    'SELECT * FROM parametros_trabalho WHERE trabalho_id = ?',
    [trabalhoId]
  );
  return linhas[0] ?? null;
}

export async function salvarParametros(trabalhoId, dados) {
  const {
    cargo, quantidade, descricaoCargo, salario, beneficios, localTrabalho, horario, requisitos, observacoes,
    quemSomos, cooperativismo, nossosValores, cobranca,
    taxaAdministrativa, encargos, margemLucro, taxaRisco,
    darPercentual, seguroVidaPercentual, inssPercentual, pisPercentual, cofinsPercentual, issPercentual,
    valorVrDia, valorVtDia, insalubridadePrePct, insalubridadeMediaPct, insalubridadeMaximaPct,
  } = dados;
  await pool.query(
    `INSERT INTO parametros_trabalho
       (trabalho_id, cargo, quantidade, descricao_cargo, salario, beneficios, local_trabalho, horario, requisitos, observacoes,
        quem_somos, cooperativismo, nossos_valores, cobranca, taxa_administrativa, encargos_sociais, margem_lucro, taxa_risco,
        dar_percentual, seguro_vida_percentual, inss_percentual, pis_percentual, cofins_percentual, iss_percentual,
        valor_vr_dia, valor_vt_dia, insalubridade_pre_pct, insalubridade_media_pct, insalubridade_maxima_pct)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       cargo = VALUES(cargo), quantidade = VALUES(quantidade), descricao_cargo = VALUES(descricao_cargo),
       salario = VALUES(salario), beneficios = VALUES(beneficios), local_trabalho = VALUES(local_trabalho),
       horario = VALUES(horario), requisitos = VALUES(requisitos), observacoes = VALUES(observacoes),
       quem_somos = VALUES(quem_somos), cooperativismo = VALUES(cooperativismo),
       nossos_valores = VALUES(nossos_valores), cobranca = VALUES(cobranca),
       taxa_administrativa = VALUES(taxa_administrativa), encargos_sociais = VALUES(encargos_sociais),
       margem_lucro = VALUES(margem_lucro), taxa_risco = VALUES(taxa_risco),
       dar_percentual = VALUES(dar_percentual), seguro_vida_percentual = VALUES(seguro_vida_percentual),
       inss_percentual = VALUES(inss_percentual), pis_percentual = VALUES(pis_percentual),
       cofins_percentual = VALUES(cofins_percentual), iss_percentual = VALUES(iss_percentual),
       valor_vr_dia = VALUES(valor_vr_dia), valor_vt_dia = VALUES(valor_vt_dia),
       insalubridade_pre_pct = VALUES(insalubridade_pre_pct),
       insalubridade_media_pct = VALUES(insalubridade_media_pct),
       insalubridade_maxima_pct = VALUES(insalubridade_maxima_pct),
       atualizado_em = NOW()`,
    [
      trabalhoId, cargo ?? null, quantidade ?? null, descricaoCargo ?? null, salario ?? null,
      beneficios ?? null, localTrabalho ?? null, horario ?? null, requisitos ?? null, observacoes ?? null,
      quemSomos ?? null, cooperativismo ?? null, nossosValores ?? null, cobranca ?? null,
      taxaAdministrativa ?? null, encargos ?? null, margemLucro ?? null, taxaRisco ?? null,
      darPercentual ?? null, seguroVidaPercentual ?? null, inssPercentual ?? null,
      pisPercentual ?? null, cofinsPercentual ?? null, issPercentual ?? null,
      valorVrDia ?? null, valorVtDia ?? null,
      insalubridadePrePct ?? null, insalubridadeMediaPct ?? null, insalubridadeMaximaPct ?? null,
    ]
  );
}
