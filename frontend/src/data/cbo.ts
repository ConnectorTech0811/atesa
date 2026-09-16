export interface CboItem {
  codigo: string;
  titulo: string;
  categoria?: string;
  sinonimos?: string[];
}

export const LISTA_CBO_BRASIL: CboItem[] = [
  // ── Enfermagem & Técnicos de Saúde ──
  { codigo: '3222-05', titulo: 'Técnico de enfermagem', categoria: 'Enfermagem', sinonimos: ['Tec enfermagem', 'Tec. enfermagem', 'Técnico em enfermagem'] },
  { codigo: '3222-10', titulo: 'Técnico de enfermagem de terapia intensiva', categoria: 'Enfermagem', sinonimos: ['Tec enfermagem UTI', 'UTI'] },
  { codigo: '3222-15', titulo: 'Técnico de enfermagem do trabalho', categoria: 'Enfermagem', sinonimos: ['Enfermagem do trabalho'] },
  { codigo: '3222-20', titulo: 'Técnico de enfermagem psiquiátrica', categoria: 'Enfermagem' },
  { codigo: '3222-25', titulo: 'Instrumentador cirúrgico', categoria: 'Enfermagem', sinonimos: ['Instrumentador', 'Instrumentação cirúrgica'] },
  { codigo: '3222-30', titulo: 'Auxiliar de enfermagem', categoria: 'Enfermagem', sinonimos: ['Aux enfermagem', 'Aux. enfermagem'] },
  { codigo: '3222-35', titulo: 'Auxiliar de enfermagem do trabalho', categoria: 'Enfermagem' },
  { codigo: '3222-45', titulo: 'Técnico de enfermagem em hemodiálise', categoria: 'Enfermagem' },
  { codigo: '3222-50', titulo: 'Técnico de enfermagem em nefrologia', categoria: 'Enfermagem' },

  // ── Enfermeiros (Nível Superior) ──
  { codigo: '2235-05', titulo: 'Enfermeiro geral', categoria: 'Enfermagem Superior', sinonimos: ['Enfermeiro', 'Enfermeira', 'Enfermeiro assistencial'] },
  { codigo: '2235-10', titulo: 'Enfermeiro auditor', categoria: 'Enfermagem Superior' },
  { codigo: '2235-15', titulo: 'Enfermeiro de bordo / resgate', categoria: 'Enfermagem Superior' },
  { codigo: '2235-20', titulo: 'Enfermeiro de centro cirúrgico', categoria: 'Enfermagem Superior' },
  { codigo: '2235-25', titulo: 'Enfermeiro de terapia intensiva (UTI)', categoria: 'Enfermagem Superior', sinonimos: ['Enfermeiro UTI'] },
  { codigo: '2235-30', titulo: 'Enfermeiro do trabalho', categoria: 'Enfermagem Superior' },
  { codigo: '2235-35', titulo: 'Enfermeiro nefrologista', categoria: 'Enfermagem Superior' },
  { codigo: '2235-40', titulo: 'Enfermeiro neonatologista', categoria: 'Enfermagem Superior' },
  { codigo: '2235-45', titulo: 'Enfermeiro obstétrico', categoria: 'Enfermagem Superior' },
  { codigo: '2235-50', titulo: 'Enfermeiro psiquiátrico', categoria: 'Enfermagem Superior' },
  { codigo: '2235-55', titulo: 'Enfermeiro puericultor e pediátrico', categoria: 'Enfermagem Superior' },
  { codigo: '2235-60', titulo: 'Enfermeiro sanitarista / saúde da família', categoria: 'Enfermagem Superior' },
  { codigo: '2235-65', titulo: 'Enfermeiro da estratégia de saúde da família', categoria: 'Enfermagem Superior' },
  { codigo: '2235-70', titulo: 'Enfermeiro visitador / Home Care', categoria: 'Enfermagem Superior', sinonimos: ['Enfermeiro visitador', 'Home Care'] },

  // ── Médicos ──
  { codigo: '2251-25', titulo: 'Médico clínico geral', categoria: 'Medicina', sinonimos: ['Clinico geral', 'Médico plantonista', 'Médico generalista'] },
  { codigo: '2251-05', titulo: 'Médico acupunturista', categoria: 'Medicina' },
  { codigo: '2251-10', titulo: 'Médico alergista e imunologista', categoria: 'Medicina' },
  { codigo: '2251-12', titulo: 'Médico cardiologista', categoria: 'Medicina', sinonimos: ['Cardiologista'] },
  { codigo: '2251-15', titulo: 'Médico angiologista', categoria: 'Medicina' },
  { codigo: '2251-18', titulo: 'Médico cirurgião cardiovascular', categoria: 'Medicina' },
  { codigo: '2251-20', titulo: 'Médico cirurgião geral', categoria: 'Medicina', sinonimos: ['Cirurgião'] },
  { codigo: '2251-22', titulo: 'Médico cirurgião plástico', categoria: 'Medicina' },
  { codigo: '2251-24', titulo: 'Médico pediatra', categoria: 'Medicina', sinonimos: ['Pediatra'] },
  { codigo: '2251-27', titulo: 'Médico ortopedista e traumatologista', categoria: 'Medicina', sinonimos: ['Ortopedista'] },
  { codigo: '2251-30', titulo: 'Médico de família e comunidade', categoria: 'Medicina' },
  { codigo: '2251-33', titulo: 'Médico psiquiatra', categoria: 'Medicina', sinonimos: ['Psiquiatra'] },
  { codigo: '2251-35', titulo: 'Médico dermatologista', categoria: 'Medicina', sinonimos: ['Dermatologista'] },
  { codigo: '2251-36', titulo: 'Médico do trabalho', categoria: 'Medicina' },
  { codigo: '2251-40', titulo: 'Médico ginecologista e obstetra', categoria: 'Medicina', sinonimos: ['Ginecologista', 'Obstetra'] },
  { codigo: '2251-45', titulo: 'Médico hematologista', categoria: 'Medicina' },
  { codigo: '2251-50', titulo: 'Médico infectologista', categoria: 'Medicina' },
  { codigo: '2251-55', titulo: 'Médico intensivista', categoria: 'Medicina', sinonimos: ['Intensivista'] },
  { codigo: '2251-60', titulo: 'Médico mastologista', categoria: 'Medicina' },
  { codigo: '2251-65', titulo: 'Médico nefrologista', categoria: 'Medicina' },
  { codigo: '2251-70', titulo: 'Médico neurologista', categoria: 'Medicina', sinonimos: ['Neurologista'] },
  { codigo: '2251-75', titulo: 'Médico nutrologista', categoria: 'Medicina' },
  { codigo: '2251-80', titulo: 'Médico oftalmologista', categoria: 'Medicina', sinonimos: ['Oftalmologista'] },
  { codigo: '2251-85', titulo: 'Médico oncologista clínico', categoria: 'Medicina', sinonimos: ['Oncologista'] },
  { codigo: '2251-95', titulo: 'Médico radiologista e diagnóstico por imagem', categoria: 'Medicina', sinonimos: ['Radiologista'] },
  { codigo: '2251-51', titulo: 'Médico anestesiologista', categoria: 'Medicina', sinonimos: ['Anestesista', 'Anestesiologista'] },
  { codigo: '2252-03', titulo: 'Médico cirurgião do aparelho digestivo', categoria: 'Medicina' },
  { codigo: '2252-25', titulo: 'Médico cirurgião pediátrico', categoria: 'Medicina' },
  { codigo: '2252-50', titulo: 'Médico cirurgião torácico', categoria: 'Medicina' },
  { codigo: '2252-70', titulo: 'Médico cirurgião vascular', categoria: 'Medicina' },
  { codigo: '2252-85', titulo: 'Médico urologista', categoria: 'Medicina', sinonimos: ['Urologista'] },
  { codigo: '2253-20', titulo: 'Médico patologista', categoria: 'Medicina' },
  { codigo: '2253-25', titulo: 'Médico patologista clínico / medicina laboratorial', categoria: 'Medicina' },
  { codigo: '2253-35', titulo: 'Médico ultrassonografista', categoria: 'Medicina' },
  { codigo: '2253-40', titulo: 'Médico do pronto-socorro / emergencista', categoria: 'Medicina', sinonimos: ['Emergencista', 'Plantonista pronto socorro'] },

  // ── Outros Profissionais de Saúde (Nível Superior) ──
  { codigo: '2236-05', titulo: 'Fisioterapeuta geral', categoria: 'Fisioterapia', sinonimos: ['Fisioterapeuta'] },
  { codigo: '2236-25', titulo: 'Fisioterapeuta respiratório', categoria: 'Fisioterapia', sinonimos: ['Fisioterapia respiratória'] },
  { codigo: '2236-30', titulo: 'Fisioterapeuta neurofuncional', categoria: 'Fisioterapia' },
  { codigo: '2236-35', titulo: 'Fisioterapeuta traumato-ortopédica funcional', categoria: 'Fisioterapia' },
  { codigo: '2236-40', titulo: 'Fisioterapeuta osteopata', categoria: 'Fisioterapia' },
  { codigo: '2236-50', titulo: 'Fisioterapeuta acupunturista', categoria: 'Fisioterapia' },
  { codigo: '2236-55', titulo: 'Fisioterapeuta do trabalho', categoria: 'Fisioterapia' },
  { codigo: '2236-60', titulo: 'Fisioterapeuta em UTI / Terapia Intensiva', categoria: 'Fisioterapia', sinonimos: ['Fisioterapia UTI'] },

  { codigo: '2237-10', titulo: 'Nutricionista', categoria: 'Nutrição', sinonimos: ['Nutricionista clínico', 'Nutrição'] },
  { codigo: '2238-10', titulo: 'Fonoaudiólogo geral', categoria: 'Fonoaudiologia', sinonimos: ['Fonoaudiólogo', 'Fonoaudióloga'] },
  { codigo: '2238-15', titulo: 'Fonoaudiólogo em audiologia', categoria: 'Fonoaudiologia' },
  { codigo: '2238-20', titulo: 'Fonoaudiólogo em disfagia', categoria: 'Fonoaudiologia' },
  { codigo: '2238-25', titulo: 'Fonoaudiólogo em linguagem', categoria: 'Fonoaudiologia' },
  { codigo: '2238-30', titulo: 'Fonoaudiólogo em motricidade orofacial', categoria: 'Fonoaudiologia' },
  { codigo: '2238-35', titulo: 'Fonoaudiólogo em voz', categoria: 'Fonoaudiologia' },
  { codigo: '2238-40', titulo: 'Fonoaudiólogo educacional', categoria: 'Fonoaudiologia' },

  { codigo: '2239-05', titulo: 'Terapeuta ocupacional', categoria: 'Terapia Ocupacional', sinonimos: ['T.O.', 'Terapeuta Ocupacional'] },
  { codigo: '2515-10', titulo: 'Psicólogo clínico', categoria: 'Psicologia', sinonimos: ['Psicólogo', 'Psicóloga'] },
  { codigo: '2515-30', titulo: 'Psicólogo social', categoria: 'Psicologia' },
  { codigo: '2515-40', titulo: 'Psicólogo do trabalho / organizacional', categoria: 'Psicologia' },
  { codigo: '2515-45', titulo: 'Psicólogo hospitalar', categoria: 'Psicologia' },
  { codigo: '2515-50', titulo: 'Psicanalista', categoria: 'Psicologia' },

  { codigo: '2234-05', titulo: 'Farmacêutico', categoria: 'Farmácia', sinonimos: ['Farmacêutica'] },
  { codigo: '2234-15', titulo: 'Farmacêutico hospitalar e clínico', categoria: 'Farmácia', sinonimos: ['Farmacêutico hospitalar'] },
  { codigo: '2234-20', titulo: 'Farmacêutico bioquímico', categoria: 'Farmácia' },
  { codigo: '2234-25', titulo: 'Farmacêutico de manipulação', categoria: 'Farmácia' },
  { codigo: '2234-30', titulo: 'Farmacêutico em saúde pública', categoria: 'Farmácia' },

  { codigo: '2232-08', titulo: 'Cirurgião-dentista - clínico geral', categoria: 'Odontologia', sinonimos: ['Dentista', 'Odontologista'] },
  { codigo: '2232-12', titulo: 'Cirurgião-dentista - endodontista', categoria: 'Odontologia' },
  { codigo: '2232-36', titulo: 'Cirurgião-dentista - ortodontista', categoria: 'Odontologia' },
  { codigo: '2232-40', titulo: 'Cirurgião-dentista - periodontista', categoria: 'Odontologia' },
  { codigo: '2232-68', titulo: 'Cirurgião-dentista - traumatologista bucomaxilofacial', categoria: 'Odontologia' },

  { codigo: '2516-05', titulo: 'Assistente social', categoria: 'Serviço Social', sinonimos: ['Serviço Social'] },
  { codigo: '2211-05', titulo: 'Biólogo', categoria: 'Biologia' },
  { codigo: '2212-05', titulo: 'Biomédico', categoria: 'Biomedicina', sinonimos: ['Biomedicina'] },
  { codigo: '2241-05', titulo: 'Profissional de educação física na saúde', categoria: 'Educação Física' },

  // ── Técnicos de Apoio e Diagnóstico em Saúde ──
  { codigo: '3241-15', titulo: 'Técnico em radiologia e imagem', categoria: 'Técnicos em Saúde', sinonimos: ['Técnico de raio-x', 'Técnico em radiologia', 'Técnico de tomografia'] },
  { codigo: '3241-20', titulo: 'Tecnólogo em radiologia', categoria: 'Técnicos em Saúde' },
  { codigo: '3241-25', titulo: 'Técnico em métodos gráficos em cardiologia / ECG', categoria: 'Técnicos em Saúde', sinonimos: ['Técnico de ECG', 'Métodos gráficos'] },
  { codigo: '3242-05', titulo: 'Técnico em patologia clínica (laboratório)', categoria: 'Técnicos em Saúde', sinonimos: ['Técnico de laboratório', 'Coletador de sangue'] },
  { codigo: '3242-10', titulo: 'Técnico em hemoterapia', categoria: 'Técnicos em Saúde', sinonimos: ['Banco de sangue'] },
  { codigo: '3223-05', titulo: 'Técnico em óptica e optometria / oftálmico', categoria: 'Técnicos em Saúde', sinonimos: ['Tecnólogo oftálmico', 'Optometrista'] },
  { codigo: '3252-10', titulo: 'Técnico em nutrição e dietética', categoria: 'Técnicos em Saúde', sinonimos: ['Técnico de nutrição'] },
  { codigo: '3251-05', titulo: 'Técnico em farmácia', categoria: 'Técnicos em Saúde', sinonimos: ['Técnico de farmácia'] },
  { codigo: '3251-10', titulo: 'Técnico em bioquímica', categoria: 'Técnicos em Saúde' },
  { codigo: '3224-05', titulo: 'Técnico em saúde bucal', categoria: 'Técnicos em Saúde', sinonimos: ['TSB'] },
  { codigo: '3224-15', titulo: 'Auxiliar em saúde bucal', categoria: 'Técnicos em Saúde', sinonimos: ['ASB'] },
  { codigo: '3224-10', titulo: 'Protético dentário', categoria: 'Técnicos em Saúde' },
  { codigo: '3221-05', titulo: 'Massoterapeuta', categoria: 'Técnicos em Saúde' },
  { codigo: '3221-10', titulo: 'Podólogo', categoria: 'Técnicos em Saúde' },
  { codigo: '3221-15', titulo: 'Acupunturista técnico', categoria: 'Técnicos em Saúde' },

  // ── Cuidados, Atendimento e Apoio Hospitalar ──
  { codigo: '5162-10', titulo: 'Cuidador de idosos', categoria: 'Cuidados & Apoio', sinonimos: ['Cuidador', 'Cuidadora de idosos', 'Acompanhante de idosos'] },
  { codigo: '5162-05', titulo: 'Babá / Cuidador de crianças', categoria: 'Cuidados & Apoio' },
  { codigo: '5162-20', titulo: 'Cuidador em saúde / Home Care', categoria: 'Cuidados & Apoio', sinonimos: ['Cuidador domiciliar', 'Home Care'] },
  { codigo: '5152-25', titulo: 'Maqueiro hospitalar', categoria: 'Cuidados & Apoio', sinonimos: ['Maqueiro', 'Condutor de pacientes'] },
  { codigo: '5152-15', titulo: 'Auxiliar de banco de sangue', categoria: 'Cuidados & Apoio' },
  { codigo: '5152-20', titulo: 'Auxiliar de farmácia hospitalar / drogaria', categoria: 'Cuidados & Apoio', sinonimos: ['Auxiliar de farmácia', 'Balconista de farmácia'] },
  { codigo: '5211-30', titulo: 'Atendente de farmácia - balconista', categoria: 'Comércio & Farmácia', sinonimos: ['Atendente de farmácia', 'Balconista farmácia'] },
  { codigo: '5151-05', titulo: 'Agente comunitário de saúde', categoria: 'Saúde Pública', sinonimos: ['ACS', 'Agente de saúde'] },
  { codigo: '5151-20', titulo: 'Agente de saúde pública / endemias', categoria: 'Saúde Pública' },
  { codigo: '5151-25', titulo: 'Agente de combate a endemias', categoria: 'Saúde Pública' },
  { codigo: '5151-30', titulo: 'Agente de proteção ambiental', categoria: 'Saúde Pública' },
  { codigo: '5151-35', titulo: 'Socorrista (exceto médicos e enfermeiros)', categoria: 'Atendimento Pré-Hospitalar', sinonimos: ['Socorrista', 'Resgatista', 'Condutor socorrista'] },

  // ── Administrativo, Faturamento, RH e Finanças ──
  { codigo: '4110-10', titulo: 'Assistente administrativo', categoria: 'Administrativo', sinonimos: ['Assistente adm', 'Auxiliar de faturamento'] },
  { codigo: '4110-05', titulo: 'Auxiliar de escritório / administrativo', categoria: 'Administrativo', sinonimos: ['Auxiliar administrativo', 'Aux. administrativo'] },
  { codigo: '4142-15', titulo: 'Faturista hospitalar / de convênios', categoria: 'Administrativo', sinonimos: ['Faturista', 'Faturamento hospitalar'] },
  { codigo: '4141-05', titulo: 'Almoxarife hospitalar / estoquista', categoria: 'Logística & Suprimentos', sinonimos: ['Almoxarife', 'Estoquista'] },
  { codigo: '4141-10', titulo: 'Armazenista', categoria: 'Logística & Suprimentos' },
  { codigo: '4141-20', titulo: 'Conferente de carga e descarga', categoria: 'Logística & Suprimentos' },
  { codigo: '4121-10', titulo: 'Digitador / Operador de dados', categoria: 'Administrativo', sinonimos: ['Digitador'] },
  { codigo: '4122-05', titulo: 'Contínuo / Office-boy', categoria: 'Administrativo' },
  { codigo: '4131-10', titulo: 'Auxiliar de contabilidade', categoria: 'Financeiro' },
  { codigo: '4131-05', titulo: 'Assistente de contabilidade', categoria: 'Financeiro' },
  { codigo: '4132-05', titulo: 'Atendente de agência bancária', categoria: 'Financeiro' },
  { codigo: '4132-25', titulo: 'Auxiliar de cobrança', categoria: 'Financeiro' },
  { codigo: '4132-30', titulo: 'Auxiliar de contas a pagar e receber', categoria: 'Financeiro' },
  { codigo: '4142-05', titulo: 'Auxiliar de compras', categoria: 'Suprimentos' },
  { codigo: '3514-05', titulo: 'Analista de recursos humanos (RH)', categoria: 'Recursos Humanos', sinonimos: ['Analista de RH'] },
  { codigo: '4110-30', titulo: 'Auxiliar de pessoal / Departamento pessoal', categoria: 'Recursos Humanos', sinonimos: ['Auxiliar de DP', 'Assistente de DP'] },
  { codigo: '1421-05', titulo: 'Gerente administrativo', categoria: 'Gestão' },
  { codigo: '1421-15', titulo: 'Gerente financeiro', categoria: 'Gestão' },
  { codigo: '1421-20', titulo: 'Gerente de recursos humanos', categoria: 'Gestão' },
  { codigo: '1423-05', titulo: 'Gerente de compras / suprimentos', categoria: 'Gestão' },
  { codigo: '1425-05', titulo: 'Gerente de tecnologia da informação (TI)', categoria: 'Gestão' },
  { codigo: '1312-05', titulo: 'Diretor de serviços de saúde', categoria: 'Gestão de Saúde' },
  { codigo: '1312-10', titulo: 'Gerente de serviços de saúde', categoria: 'Gestão de Saúde', sinonimos: ['Gerente hospitalar'] },
  { codigo: '4101-05', titulo: 'Supervisor administrativo', categoria: 'Gestão' },

  // ── Recepção, Atendimento e Telefonia ──
  { codigo: '4221-05', titulo: 'Recepcionista geral / hospitalar', categoria: 'Atendimento', sinonimos: ['Recepcionista', 'Recepcionista hospitalar', 'Atendente'] },
  { codigo: '4221-10', titulo: 'Recepcionista de consultório médico / clínica', categoria: 'Atendimento', sinonimos: ['Recepcionista clínica'] },
  { codigo: '4222-05', titulo: 'Operador de teleatendimento / Call Center', categoria: 'Atendimento', sinonimos: ['Operador de telemarketing', 'Call Center'] },
  { codigo: '4222-10', titulo: 'Telefonista', categoria: 'Atendimento' },
  { codigo: '4222-20', titulo: 'Operador de rádio-chamada / SAMU', categoria: 'Atendimento' },
  { codigo: '4223-05', titulo: 'Operador de atendimento receptivo', categoria: 'Atendimento' },
  { codigo: '4211-25', titulo: 'Operador de caixa', categoria: 'Atendimento' },

  // ── Transporte & Condução ──
  { codigo: '7823-10', titulo: 'Motorista de ambulância', categoria: 'Transporte', sinonimos: ['Condutor de ambulância', 'Motorista socorrista'] },
  { codigo: '7823-05', titulo: 'Motorista de furgão ou veículo leve', categoria: 'Transporte', sinonimos: ['Motorista'] },
  { codigo: '7823-20', titulo: 'Motorista de táxi / aplicativo', categoria: 'Transporte' },
  { codigo: '7824-05', titulo: 'Motorista de ônibus urbano', categoria: 'Transporte' },
  { codigo: '7825-10', titulo: 'Motorista de caminhão (rotas regionais e internacionais)', categoria: 'Transporte' },
  { codigo: '5199-35', titulo: 'Manobrista', categoria: 'Transporte' },

  // ── Portaria, Vigilância, Segurança e Manutenção ──
  { codigo: '5174-10', titulo: 'Porteiro de edifícios / hospitalar', categoria: 'Portaria & Segurança', sinonimos: ['Porteiro', 'Portaria'] },
  { codigo: '5174-15', titulo: 'Controlador de acesso', categoria: 'Portaria & Segurança', sinonimos: ['Controlador de entrada'] },
  { codigo: '5174-20', titulo: 'Vigia', categoria: 'Portaria & Segurança' },
  { codigo: '5173-30', titulo: 'Vigilante', categoria: 'Portaria & Segurança' },
  { codigo: '5141-20', titulo: 'Zelador de edifício', categoria: 'Predial & Conservação', sinonimos: ['Zelador'] },
  { codigo: '5143-20', titulo: 'Faxineiro / Auxiliar de limpeza hospitalar', categoria: 'Higiene & Conservação', sinonimos: ['Auxiliar de limpeza', 'Auxiliar de higienização', 'Faxineira'] },
  { codigo: '5143-25', titulo: 'Trabalhador da manutenção de edifícios / Oficial de manutenção', categoria: 'Manutenção', sinonimos: ['Oficial de manutenção', 'Manutenção predial'] },
  { codigo: '7156-15', titulo: 'Eletricista de manutenção predial / hospitalar', categoria: 'Manutenção', sinonimos: ['Eletricista'] },
  { codigo: '7241-10', titulo: 'Encanador / Instalador de tubulações', categoria: 'Manutenção', sinonimos: ['Encanador', 'Bombeiro hidráulico'] },
  { codigo: '7166-10', titulo: 'Pintor de obras', categoria: 'Manutenção' },
  { codigo: '7152-10', titulo: 'Pedreiro', categoria: 'Manutenção' },
  { codigo: '5142-25', titulo: 'Trabalhador de coleta de resíduos hospitalares / lixo', categoria: 'Higiene & Conservação' },
  { codigo: '5163-05', titulo: 'Lavador de roupas / Lavanderia hospitalar', categoria: 'Lavanderia & Rouparia', sinonimos: ['Lavadeira', 'Auxiliar de lavanderia'] },
  { codigo: '5163-40', titulo: 'Atendente de lavanderia / Rouparia', categoria: 'Lavanderia & Rouparia', sinonimos: ['Roupeiro'] },

  // ── Copa, Cozinha & Nutrição Hospitalar ──
  { codigo: '5132-05', titulo: 'Cozinheiro geral / hospitalar', categoria: 'Alimentação & Nutrição', sinonimos: ['Cozinheiro', 'Cozinheira'] },
  { codigo: '5135-05', titulo: 'Auxiliar de cozinha / pré-preparo', categoria: 'Alimentação & Nutrição', sinonimos: ['Auxiliar de cozinha', 'Ajudante de cozinha'] },
  { codigo: '5134-35', titulo: 'Atendente de lanchonete / Copeiro(a) hospitalar', categoria: 'Alimentação & Nutrição', sinonimos: ['Copeiro', 'Copeira hospitalar', 'Copeira'] },
  { codigo: '5134-25', titulo: 'Garçom / Garçonete', categoria: 'Alimentação & Nutrição' },

  // ── Tecnologia da Informação (TI) & Engenharia ──
  { codigo: '2124-05', titulo: 'Analista de desenvolvimento de sistemas', categoria: 'Tecnologia da Informação', sinonimos: ['Programador', 'Desenvolvedor', 'Engenheiro de software'] },
  { codigo: '2124-10', titulo: 'Analista de redes e comunicação de dados', categoria: 'Tecnologia da Informação' },
  { codigo: '2124-20', titulo: 'Analista de suporte computacional', categoria: 'Tecnologia da Informação' },
  { codigo: '3171-10', titulo: 'Técnico de suporte ao usuário de TI (Help Desk)', categoria: 'Tecnologia da Informação', sinonimos: ['Suporte de TI', 'Help Desk'] },
  { codigo: '3172-05', titulo: 'Operador de computador', categoria: 'Tecnologia da Informação' },
  { codigo: '2149-10', titulo: 'Engenheiro clínico / hospitalar', categoria: 'Engenharia Clínica' },
  { codigo: '3141-10', titulo: 'Técnico em manutenção de equipamentos médico-hospitalares', categoria: 'Engenharia Clínica', sinonimos: ['Técnico de equipamentos médicos'] },
  { codigo: '2149-15', titulo: 'Engenheiro de segurança do trabalho', categoria: 'Segurança do Trabalho' },
  { codigo: '3516-05', titulo: 'Técnico de segurança do trabalho', categoria: 'Segurança do Trabalho', sinonimos: ['TST', 'Técnico de segurança'] },
];

/**
 * Busca flexível de CBO por código, título, categoria ou sinônimo
 */
export function buscarCbos(termo: string, limite = 50): CboItem[] {
  if (!termo || !termo.trim()) {
    return LISTA_CBO_BRASIL.slice(0, limite);
  }
  const clean = termo.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const digitsOnly = termo.replace(/\D/g, '');

  return LISTA_CBO_BRASIL.filter((item) => {
    const itemCodeDigits = item.codigo.replace(/\D/g, '');
    if (digitsOnly && itemCodeDigits.includes(digitsOnly)) return true;

    const normTitle = item.titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normTitle.includes(clean)) return true;

    if (item.categoria) {
      const normCat = item.categoria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normCat.includes(clean)) return true;
    }

    if (item.sinonimos?.some(s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(clean))) {
      return true;
    }

    return false;
  }).slice(0, limite);
}

/**
 * Obtém os detalhes de um CBO a partir do código ou texto parcial
 */
export function obterDetalhesCbo(codigoOuTexto: string): CboItem | undefined {
  if (!codigoOuTexto) return undefined;
  const rawCode = codigoOuTexto.split('-')[0].trim().replace(/\D/g, '');
  
  return LISTA_CBO_BRASIL.find((item) => {
    const itemDigits = item.codigo.replace(/\D/g, '');
    if (rawCode && itemDigits.startsWith(rawCode)) return true;
    return item.codigo === codigoOuTexto.trim() || item.titulo.toLowerCase() === codigoOuTexto.toLowerCase().trim();
  });
}
