import React, { useRef, useState, useEffect, useCallback } from 'react';

interface SignaturePadProps {
  value?: string | null; // Base64 PNG
  onChange: (base64Png: string) => void;
  onClear?: () => void;
  width?: number | string;
  height?: number;
  label?: string;
  nomeSignatario?: string;
  cpfSignatario?: string;
  disabled?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  value,
  onChange,
  onClear,
  width = '100%',
  height = 160,
  label = 'Assinatura Digital de Próprio Punho',
  nomeSignatario,
  cpfSignatario,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [desenhando, setDesenhando] = useState(false);
  const [temAssinatura, setTemAssinatura] = useState(Boolean(value));
  const [ultimaPos, setUltimaPos] = useState<{ x: number; y: number } | null>(null);

  // Inicializa o canvas com suporte a Retina/High DPI
  const redimensionarCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Se já tiver uma imagem em base64 salva, restaura no canvas
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = value;
    }
  }, [value]);

  useEffect(() => {
    redimensionarCanvas();
    window.addEventListener('resize', redimensionarCanvas);
    return () => window.removeEventListener('resize', redimensionarCanvas);
  }, [redimensionarCanvas]);

  const obterCoordenadas = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleInicio = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const pos = obterCoordenadas(e.nativeEvent);
    if (!pos) return;
    setDesenhando(true);
    setUltimaPos(pos);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const handleMover = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!desenhando || disabled) return;
    if (e.cancelable) e.preventDefault();

    const pos = obterCoordenadas(e.nativeEvent);
    if (!pos || !ultimaPos) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    setUltimaPos(pos);
    setTemAssinatura(true);
  };

  const handleFim = () => {
    if (!desenhando || disabled) return;
    setDesenhando(false);
    setUltimaPos(null);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const base64 = canvas.toDataURL('image/png');
    onChange(base64);
  };

  const handleLimpar = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setTemAssinatura(false);
    onChange('');
    if (onClear) onClear();
  };

  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>
          ✍️ {label}
        </label>
        {temAssinatura && !disabled && (
          <button
            type="button"
            onClick={handleLimpar}
            style={{
              background: '#fee2e2',
              color: '#b91c1c',
              border: 'none',
              borderRadius: 6,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ✕ Limpar Assinatura
          </button>
        )}
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          height,
          background: '#ffffff',
          borderRadius: 8,
          border: '1.5px solid #94a3b8',
          boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.06)',
          touchAction: 'none',
          cursor: disabled ? 'not-allowed' : 'crosshair',
          overflow: 'hidden',
        }}
      >
        {/* Linha guia de assinatura */}
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            left: 20,
            right: 20,
            borderBottom: '1px dashed #cbd5e1',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 800, paddingBottom: 2, marginRight: 6 }}>
            ✕
          </span>
        </div>

        {/* Informação do Signatário abaixo da linha */}
        {(nomeSignatario || cpfSignatario) && (
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: 10.5,
              color: '#64748b',
              pointerEvents: 'none',
              fontWeight: 600,
            }}
          >
            {nomeSignatario} {cpfSignatario ? `· CPF ${cpfSignatario}` : ''}
          </div>
        )}

        {/* Canvas de desenho */}
        <canvas
          ref={canvasRef}
          onMouseDown={handleInicio}
          onMouseMove={handleMover}
          onMouseUp={handleFim}
          onMouseLeave={handleFim}
          onTouchStart={handleInicio}
          onTouchMove={handleMover}
          onTouchEnd={handleFim}
          onTouchCancel={handleFim}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        />

        {/* Marca d'água / Dica inicial quando vazio */}
        {!temAssinatura && !desenhando && (
          <div
            style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#94a3b8',
              fontSize: 12,
              pointerEvents: 'none',
              textAlign: 'center',
              fontWeight: 500,
            }}
          >
            Toque ou use o mouse para assinar aqui
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
        <span>Assinatura digital com carimbo de data e integridade.</span>
        {temAssinatura && (
          <span style={{ color: '#15803d', fontWeight: 700 }}>✓ Assinatura capturada</span>
        )}
      </div>
    </div>
  );
};
