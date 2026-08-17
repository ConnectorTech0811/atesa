/**
 * Sistema de toast/modal de notificação com timer de 10s e botão X.
 *
 * Uso:
 *   const { showToast } = useToast();
 *   showToast('Candidato aprovado!\nMatrícula: RA20260001', 'success');
 *   showToast('Permita pop-ups para gerar o PDF.', 'warning');
 *   showToast('Erro ao atualizar ocorrência.', 'error');
 */

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { IconX, IconCheckCircle, IconAlert } from './Icons';

// ── Tipos ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

// ── Contexto ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

// ── Paleta por tipo ───────────────────────────────────────────────────────────

const TOAST_THEME: Record<ToastType, { bg: string; border: string; cor: string; icon: React.ReactNode }> = {
  success: { bg: '#f0fdf4', border: '#86efac', cor: '#16a34a', icon: <IconCheckCircle size={18} /> },
  error:   { bg: '#fff1f2', border: '#fca5a5', cor: '#dc2626', icon: <IconAlert size={18} /> },
  warning: { bg: '#fffbeb', border: '#fcd34d', cor: '#d97706', icon: <IconAlert size={18} /> },
  info:    { bg: '#eff6ff', border: '#93c5fd', cor: '#2563eb', icon: <IconCheckCircle size={18} /> },
};

// ── Componente individual de toast ────────────────────────────────────────────

const DURACAO = 10; // segundos

function ToastCard({ item, onClose }: { item: ToastItem; onClose: (id: number) => void }) {
  const [progresso, setProgresso] = React.useState(100);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const t = TOAST_THEME[item.type];

  React.useEffect(() => {
    const inicio = Date.now();
    timer.current = setInterval(() => {
      const decorrido = (Date.now() - inicio) / 1000;
      const restante = Math.max(0, 100 - (decorrido / DURACAO) * 100);
      setProgresso(restante);
      if (restante <= 0) {
        clearInterval(timer.current!);
        onClose(item.id);
      }
    }, 50);
    return () => clearInterval(timer.current!);
  }, [item.id, onClose]);

  // Quebrar mensagem por \n para exibir múltiplas linhas
  const linhas = item.message.split('\n');

  return (
    <div
      style={{
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderLeft: `4px solid ${t.cor}`,
        borderRadius: 10,
        padding: '12px 14px 8px 14px',
        minWidth: 260,
        maxWidth: 340,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        position: 'relative',
        overflow: 'hidden',
        animation: 'toastIn 0.2s ease',
      }}
    >
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingRight: 24 }}>
        <span style={{ color: t.cor, flexShrink: 0, marginTop: 1 }}>{t.icon}</span>
        <div>
          {linhas.map((linha, i) => (
            <div
              key={i}
              style={{
                fontSize: i === 0 ? 13 : 12,
                fontWeight: i === 0 ? 600 : 400,
                color: i === 0 ? t.cor : '#555',
                lineHeight: 1.4,
                marginTop: i > 0 ? 2 : 0,
              }}
            >
              {linha}
            </div>
          ))}
        </div>
      </div>

      {/* Botão fechar */}
      <button
        onClick={() => onClose(item.id)}
        style={{
          position: 'absolute', top: 8, right: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#999', padding: 2, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 4,
        }}
        title="Fechar"
      >
        <IconX size={14} />
      </button>

      {/* Barra de progresso */}
      <div style={{ marginTop: 8, height: 3, background: t.border, borderRadius: 2 }}>
        <div
          style={{
            height: '100%', borderRadius: 2,
            background: t.cor,
            width: `${progresso}%`,
            transition: 'width 0.05s linear',
          }}
        />
      </div>
    </div>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const fechar = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Container de toasts — canto superior direito */}
      <div
        style={{
          position: 'fixed', top: 20, right: 20,
          zIndex: 99999,
          display: 'flex', flexDirection: 'column', gap: 10,
          pointerEvents: 'none',
        }}
      >
        <style>{`
          @keyframes toastIn {
            from { opacity: 0; transform: translateX(24px); }
            to   { opacity: 1; transform: translateX(0); }
          }
        `}</style>
        {toasts.map((item) => (
          <div key={item.id} style={{ pointerEvents: 'auto' }}>
            <ToastCard item={item} onClose={fechar} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
