import React, { useState, useEffect, useRef } from 'react';
import { LISTA_CBO_BRASIL, CboItem, buscarCbos, obterDetalhesCbo } from '../data/cbo';

interface CboSelectProps {
  value?: string;
  onChange: (codigo: string, item?: CboItem) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export const CboSelect: React.FC<CboSelectProps> = ({
  value = '',
  onChange,
  placeholder = 'Buscar por código (ex: 3222-05) ou ocupação (ex: Técnico de enfermagem)...',
  disabled = false,
  style,
}) => {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todos');
  const containerRef = useRef<HTMLDivElement>(null);

  // Detalhes do CBO atualmente selecionado (se houver)
  const cboSelecionado = obterDetalhesCbo(value);

  // Inicializa o texto de busca quando o valor muda
  useEffect(() => {
    if (value) {
      const match = obterDetalhesCbo(value);
      if (match) {
        setBusca(`${match.codigo} - ${match.titulo}`);
      } else {
        setBusca(value);
      }
    } else {
      setBusca('');
    }
  }, [value]);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
        // Se o usuário não selecionou nada mas digitou algo, restaura o label do valor atual
        if (value) {
          const match = obterDetalhesCbo(value);
          setBusca(match ? `${match.codigo} - ${match.titulo}` : value);
        } else {
          setBusca('');
        }
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, [value]);

  // Lista de categorias únicas para filtros rápidos
  const categorias = ['todos', 'Enfermagem', 'Medicina', 'Fisioterapia', 'Cuidados & Apoio', 'Técnicos em Saúde', 'Administrativo', 'Gestão'];

  // Resultados filtrados
  const resultados = buscarCbos(busca.includes(' - ') ? busca.split(' - ')[0] : busca, 100).filter(item => {
    if (categoriaFiltro === 'todos') return true;
    return item.categoria === categoriaFiltro || item.categoria?.toLowerCase().includes(categoriaFiltro.toLowerCase());
  });

  const handleSelect = (item: CboItem) => {
    setBusca(`${item.codigo} - ${item.titulo}`);
    setAberto(false);
    onChange(item.codigo, item);
  };

  const handleLimpar = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusca('');
    onChange('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBusca(val);
    setAberto(true);
    // Se o usuário digitou exatamente um código de CBO válido
    const match = obterDetalhesCbo(val);
    if (match) {
      onChange(match.codigo, match);
    } else {
      onChange(val);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      {/* Campo de Entrada com Busca */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          border: aberto ? '1.5px solid #4a9e4f' : '1.5px solid #cccccc',
          borderRadius: 6,
          background: disabled ? '#f5f5f5' : '#ffffff',
          boxShadow: aberto ? '0 0 0 3px rgba(74, 158, 79, 0.15)' : 'none',
          transition: 'all 0.2s ease',
          paddingRight: 8,
        }}
      >
        <div style={{ paddingLeft: 10, color: '#4a9e4f', display: 'flex', alignItems: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
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
            padding: '7px 10px',
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
            onClick={handleLimpar}
            title="Limpar seleção"
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

      {/* Tag de confirmação do CBO selecionado */}
      {cboSelecionado && (
        <div
          style={{
            marginTop: 4,
            fontSize: 11.5,
            color: '#2e7d32',
            background: '#e8f5e9',
            padding: '3px 8px',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 500,
          }}
        >
          <span style={{ fontWeight: 700 }}>✓ CBO {cboSelecionado.codigo}:</span>
          <span>{cboSelecionado.titulo}</span>
          {cboSelecionado.categoria && (
            <span style={{ background: '#c8e6c9', color: '#1b5e20', padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 600 }}>
              {cboSelecionado.categoria}
            </span>
          )}
        </div>
      )}

      {/* Dropdown Popover */}
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
            maxHeight: 320,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Barra de Categorias Rápidas */}
          <div
            style={{
              padding: '6px 8px',
              background: '#f8f9fa',
              borderBottom: '1px solid #eee',
              display: 'flex',
              gap: 4,
              overflowX: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {categorias.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoriaFiltro(cat)}
                style={{
                  padding: '3px 8px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: categoriaFiltro === cat ? 700 : 500,
                  background: categoriaFiltro === cat ? '#4a9e4f' : '#ffffff',
                  color: categoriaFiltro === cat ? '#ffffff' : '#555555',
                  border: categoriaFiltro === cat ? '1px solid #4a9e4f' : '1px solid #ddd',
                  cursor: 'pointer',
                  textTransform: cat === 'todos' ? 'capitalize' : 'none',
                }}
              >
                {cat === 'todos' ? 'Todas Ocupações' : cat}
              </button>
            ))}
          </div>

          {/* Lista de Itens */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {resultados.length === 0 ? (
              <div style={{ padding: '16px 12px', textAlign: 'center', color: '#888', fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Nenhuma ocupação encontrada</div>
                <div>Você pode digitar o código numérico customizado caso deseje.</div>
              </div>
            ) : (
              resultados.map((item) => {
                const isSelected = item.codigo === value;
                return (
                  <div
                    key={item.codigo}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: 12,
                            background: '#eef2f6',
                            color: '#2b3b4c',
                            padding: '2px 6px',
                            borderRadius: 4,
                            border: '1px solid #d2dce6',
                          }}
                        >
                          {item.codigo}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: '#1a1a1a' }}>
                          {item.titulo}
                        </span>
                      </div>
                      {item.sinonimos && item.sinonimos.length > 0 && (
                        <div style={{ fontSize: 11, color: '#777', paddingLeft: 2 }}>
                          Sinônimos: {item.sinonimos.join(', ')}
                        </div>
                      )}
                    </div>
                    {item.categoria && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: '#f0f0f0',
                          color: '#555',
                          whiteSpace: 'nowrap',
                          marginLeft: 8,
                        }}
                      >
                        {item.categoria}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé informativo */}
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
            <span>Classificação Brasileira de Ocupações (MTE/e-Social)</span>
            <span>{resultados.length} opções</span>
          </div>
        </div>
      )}
    </div>
  );
};
