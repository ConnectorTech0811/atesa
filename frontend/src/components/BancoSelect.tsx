import React, { useState, useEffect, useRef } from 'react';
import { BancoItem, LISTA_BANCOS_BRASIL, obterTodosOsBancos } from '../data/bancos';

interface BancoSelectProps {
  value?: string;
  onChange: (nomeBanco: string, codigoBanco?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export const BancoSelect: React.FC<BancoSelectProps> = ({
  value = '',
  onChange,
  placeholder = 'Digite ou selecione o banco (ex: Nubank, Itaú, Bradesco, 260, Inter)...',
  disabled = false,
  style,
}) => {
  const [bancos, setBancos] = useState<BancoItem[]>(LISTA_BANCOS_BRASIL);
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Carrega lista dinâmica da BrasilAPI enriquecida
  useEffect(() => {
    obterTodosOsBancos().then((lista) => {
      if (lista && lista.length > 0) {
        setBancos(lista);
      }
    });
  }, []);

  // Sincroniza busca com o valor atual
  useEffect(() => {
    if (value) {
      setBusca(value);
    } else {
      setBusca('');
    }
  }, [value]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
        setBusca(value || '');
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, [value]);

  const filtrados = bancos.filter((b) => {
    if (!busca || !busca.trim()) return true;
    const q = busca.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nomeNorm = b.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const apelidoNorm = b.apelido ? b.apelido.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
    const sinonimosMatch = b.sinonimos?.some(s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q));

    return (
      nomeNorm.includes(q) ||
      apelidoNorm.includes(q) ||
      b.codigo.includes(busca.trim()) ||
      Boolean(sinonimosMatch)
    );
  });

  const handleSelect = (banco: BancoItem) => {
    const nomeFormatado = `${banco.codigo} - ${banco.nome}`;
    setBusca(nomeFormatado);
    setAberto(false);
    onChange(nomeFormatado, banco.codigo);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBusca(val);
    setAberto(true);
    onChange(val);
  };

  // Verifica se o banco atual selecionado é parceiro
  const isParceiro = ['341', '237', '033'].some(cod => value.includes(cod)) ||
    ['itau', 'bradesco', 'santander'].some(b => value.toLowerCase().includes(b));

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          border: aberto ? '1.5px solid #4a9e4f' : '1.5px solid #d1d5db',
          borderRadius: 6,
          background: disabled ? '#f5f5f5' : '#ffffff',
          boxShadow: aberto ? '0 0 0 3px rgba(74, 158, 79, 0.15)' : 'none',
          transition: 'all 0.2s ease',
          paddingRight: 8,
        }}
      >
        <div style={{ paddingLeft: 10, color: '#4a9e4f', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 14 }}>🏦</span>
        </div>
        <input
          type="text"
          value={busca}
          disabled={disabled}
          onChange={handleInputChange}
          onFocus={() => setAberto(true)}
          placeholder={placeholder}
          style={{
            border: 'none',
            outline: 'none',
            padding: '8px 10px',
            fontSize: 13,
            fontFamily: 'inherit',
            width: '100%',
            background: 'transparent',
            color: '#1a1a1a',
            colorScheme: 'light',
          }}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setBusca('');
              onChange('');
            }}
            title="Limpar banco"
            style={{
              background: '#eee',
              border: 'none',
              borderRadius: '50%',
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#666',
              fontSize: 11,
              fontWeight: 700,
              marginLeft: 4,
            }}
          >
            ×
          </button>
        )}
        <button
          type="button"
          onClick={() => !disabled && setAberto(!aberto)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: disabled ? 'default' : 'pointer',
            padding: '4px',
            color: '#888',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>

      {/* Aviso de Tarifa ou Isenção */}
      {value && (
        <div style={{ marginTop: 4, fontSize: 11.5 }}>
          {isParceiro ? (
            <span style={{ color: '#2e7d32', background: '#e8f5e9', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>
              ✓ Banco Parceiro ATESA (Isento de taxas)
            </span>
          ) : (
            <span style={{ color: '#b45309', background: '#fef3c7', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>
              ⚠️ Outra Instituição (Cobrança de DOC/TED: R$ 12,00 por repasse)
            </span>
          )}
        </div>
      )}

      {/* Dropdown Popover com Lista Completa e Apelidos Populares */}
      {aberto && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            background: '#ffffff',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.16), 0 2px 6px rgba(0, 0, 0, 0.08)',
            border: '1px solid #dcdcdc',
            maxHeight: 290,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {filtrados.length === 0 ? (
              <div style={{ padding: '16px 12px', textAlign: 'center', color: '#888', fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Nenhum banco encontrado</div>
                <div>Você pode manter o nome digitado para salvar.</div>
              </div>
            ) : (
              filtrados.map((item) => {
                const isSelected = value.includes(item.codigo) || value.toLowerCase().includes(item.nome.toLowerCase());
                return (
                  <div
                    key={`${item.codigo}-${item.nome}`}
                    onClick={() => handleSelect(item)}
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      background: isSelected ? '#e8f5e9' : 'transparent',
                      borderLeft: isSelected ? '3px solid #4a9e4f' : '3px solid transparent',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#f5f7f5';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: 11.5,
                          background: item.parceiro ? '#e8f5e9' : '#f1f5f9',
                          color: item.parceiro ? '#1b5e20' : '#334155',
                          padding: '2px 6px',
                          borderRadius: 4,
                          border: item.parceiro ? '1px solid #a5d6a7' : '1px solid #cbd5e1',
                          flexShrink: 0,
                        }}
                      >
                        {item.codigo}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: item.parceiro ? 700 : 500, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.nome}
                      </span>
                    </div>
                    {item.parceiro && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 10,
                          background: '#4a9e4f',
                          color: '#ffffff',
                          whiteSpace: 'nowrap',
                          marginLeft: 6,
                          flexShrink: 0,
                        }}
                      >
                        Parceiro (Sem taxa)
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div
            style={{
              padding: '6px 10px',
              background: '#fafafa',
              borderTop: '1px solid #eee',
              fontSize: 11,
              color: '#888',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>Bancos Oficiais BrasilAPI / BACEN</span>
            <span>{filtrados.length} opções</span>
          </div>
        </div>
      )}
    </div>
  );
};
