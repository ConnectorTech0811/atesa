import nodemailer from 'nodemailer';

/**
 * Cria o transporter do Nodemailer configurado com os dados SMTP (HouseTI / Zimbra).
 */
export function criarTransporter() {
  const host = (process.env.SMTP_HOST || 'smtp.emailzimbraonline.com').trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE === 'false' ? false : (port === 465 || true);
  let user = (process.env.SMTP_USER || 'nao-responda@atesa.com.br').trim().replace(/^["']|["']$/g, '');
  let pass = (process.env.SMTP_PASS || 'Senha1973!@#$').trim().replace(/^["']|["']$/g, '');

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false, // Compatibilidade com certificados Zimbra / TLS
    },
  });
}

/**
 * Envia um e-mail genérico formatado.
 */
export async function enviarEmail({ para, assunto, html, texto, remetenteNome }) {
  const transporter = criarTransporter();
  const fromUser = process.env.SMTP_USER || 'nao-responda@atesa.com.br';
  const fromName = remetenteNome || process.env.SMTP_FROM_NAME || 'ATESA';

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromUser}>`,
    to: para,
    subject: assunto,
    text: texto,
    html,
  });

  return info;
}

/**
 * Envia um e-mail institucional padronizado com o cabeçalho verde da ATESA.
 */
export async function enviarEmailInstitucional({
  para,
  assunto,
  titulo,
  subtitulo,
  corpoHtml,
  botaoTexto,
  botaoLink,
  rodapeTexto,
  remetenteNome,
}) {
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${assunto}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333333;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6fa; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="580" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          
          <!-- Header institucional Verde ATESA -->
          <tr>
            <td style="background: linear-gradient(135deg, #2e7d32 0%, #4a9e4f 100%); padding: 32px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.5px;">ATESA</h1>
              <p style="color: #e8f5e9; margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">Gestão Operacional e Cooperativa</p>
            </td>
          </tr>

          <!-- Corpo da Mensagem -->
          <tr>
            <td style="padding: 36px 32px;">
              ${titulo ? `<h2 style="color: #2e7d32; font-size: 19px; margin: 0 0 8px 0; font-weight: 700;">${titulo}</h2>` : ''}
              ${subtitulo ? `<p style="color: #666; font-size: 13px; margin: 0 0 20px 0;">${subtitulo}</p>` : ''}
              
              <div style="font-size: 14px; line-height: 1.6; color: #444444;">
                ${corpoHtml}
              </div>

              ${botaoTexto && botaoLink ? `
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0 20px 0;">
                <tr>
                  <td align="center">
                    <a href="${botaoLink}" target="_blank" style="display: inline-block; background-color: #2e7d32; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 36px; border-radius: 8px; box-shadow: 0 3px 12px rgba(46,125,50,0.35);">
                      ${botaoTexto}
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}

              ${rodapeTexto ? `
              <p style="font-size: 12px; line-height: 1.5; color: #888888; margin: 24px 0 0 0; border-top: 1px solid #eeeeee; padding-top: 16px;">
                ${rodapeTexto}
              </p>
              ` : ''}
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="background-color: #f9fbfd; padding: 20px 30px; text-align: center; border-top: 1px solid #eef2f6;">
              <p style="margin: 0; font-size: 11px; color: #999999;">
                Este é um e-mail automático enviado pelo sistema ATESA (HouseTI / Zimbra).
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #aaaaaa;">
                © ${new Date().getFullYear()} ATESA - Todos os direitos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return enviarEmail({
    para,
    assunto,
    html,
    remetenteNome: remetenteNome || 'ATESA Notificações',
  });
}

/**
 * Envia e-mail de recuperação de senha com layout institucional verde da ATESA e link com token.
 */
export async function enviarEmailRecuperacaoSenha({ email, nome, token, linkSistema }) {
  const baseUrl = (
    linkSistema ||
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://atesa.connectortech.com.br'
      : 'http://localhost:8100')
  ).replace(/\/+$/, '');
  const linkReset = `${baseUrl}/login?token=${token}`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha - ATESA</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333333;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6fa; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="580" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          
          <!-- Header institucional Verde ATESA -->
          <tr>
            <td style="background: linear-gradient(135deg, #2e7d32 0%, #4a9e4f 100%); padding: 32px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.5px;">ATESA</h1>
              <p style="color: #e8f5e9; margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">Gestão Operacional e Cooperativa</p>
            </td>
          </tr>

          <!-- Corpo da Mensagem -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="color: #2e7d32; font-size: 19px; margin: 0 0 16px 0; font-weight: 700;">
                Olá, ${nome ? nome.split(' ')[0] : 'Cooperado'}! 👋
              </h2>
              
              <p style="font-size: 14px; line-height: 1.6; color: #555555; margin: 0 0 20px 0;">
                Recebemos uma solicitação de redefinição de senha para a sua conta no <strong>Sistema ATESA</strong>.
              </p>

              <p style="font-size: 14px; line-height: 1.6; color: #555555; margin: 0 0 24px 0;">
                Clique no botão abaixo para escolher sua nova senha com segurança:
              </p>

              <!-- Botão de Ação -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${linkReset}" target="_blank" style="display: inline-block; background-color: #2e7d32; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 36px; border-radius: 8px; box-shadow: 0 3px 12px rgba(46,125,50,0.35);">
                      Redefinir Minha Senha →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Caixa Informativa -->
              <div style="background-color: #f1f8f3; border: 1.5px dashed #a5d6a7; border-radius: 8px; padding: 16px 20px; text-align: left; margin: 20px 0 0 0;">
                <span style="font-size: 12px; color: #2e7d32; font-weight: 700; display: block; margin-bottom: 4px;">
                  🔒 Link Seguro e Temporário
                </span>
                <span style="font-size: 12px; color: #666666; line-height: 1.4; display: block;">
                  Este link é válido por 2 horas. Caso o botão acima não funcione, copie e cole o endereço abaixo no seu navegador:<br />
                  <a href="${linkReset}" target="_blank" style="color: #2e7d32; word-break: break-all; font-size: 11px; margin-top: 4px; display: inline-block;">${linkReset}</a>
                </span>
              </div>

              <p style="font-size: 12px; line-height: 1.5; color: #888888; margin: 24px 0 0 0; border-top: 1px solid #eeeeee; padding-top: 16px;">
                ⚠️ Se você não solicitou a redefinição de senha, ignore este e-mail. Sua senha atual permanecerá inalterada.
              </p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="background-color: #f9fbfd; padding: 20px 30px; text-align: center; border-top: 1px solid #eef2f6;">
              <p style="margin: 0; font-size: 11px; color: #999999;">
                Este é um e-mail automático enviado pelo sistema ATESA (HouseTI / Zimbra). Por favor, não responda a esta mensagem.
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #aaaaaa;">
                © ${new Date().getFullYear()} ATESA - Todos os direitos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const texto = `
Olá, ${nome || 'Usuário'}!

Recebemos uma solicitação de redefinição de senha para a sua conta no Sistema ATESA.

Clique no link abaixo para criar sua nova senha (válido por 2 horas):
${linkReset}

Se você não solicitou esta troca, desconsidere esta mensagem.
  `.trim();

  return enviarEmail({
    para: email,
    assunto: '🔐 Redefinição de Senha - Sistema ATESA',
    html,
    texto,
    remetenteNome: 'ATESA Notificações',
  });
}
