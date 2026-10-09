import fs from 'fs';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

/**
 * Certificado digital A1 (e-CNPJ) da cooperativa.
 *
 * Configuração por variáveis de ambiente (nunca no banco):
 *   ESOCIAL_CERT_PFX_BASE64  conteúdo do .pfx em base64 (recomendado na Vercel)
 *   ESOCIAL_CERT_PATH        caminho do .pfx (alternativa para servidor próprio)
 *   ESOCIAL_CERT_SENHA       senha do .pfx
 *
 * O .pfx é convertido para PEM com node-forge: certificados ICP-Brasil costumam
 * usar criptografia legada (RC2/3DES) que o OpenSSL 3 do Node não abre direto.
 */

let cache = null;

function lerPfx() {
  if (process.env.ESOCIAL_CERT_PFX_BASE64) {
    return Buffer.from(process.env.ESOCIAL_CERT_PFX_BASE64.replace(/\s/g, ''), 'base64');
  }
  if (process.env.ESOCIAL_CERT_PATH) {
    return fs.readFileSync(process.env.ESOCIAL_CERT_PATH);
  }
  return null;
}

export function carregarCertificadoDePfx(pfxBuffer, senha) {
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBuffer.toString('binary')));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha ?? '');

  const chaves = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ];
  const chave = chaves.find((b) => b.key)?.key;
  if (!chave) throw new Error('Chave privada não encontrada no certificado.');

  const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []).map((b) => b.cert).filter(Boolean);
  // Certificado do titular: aquele cuja chave pública corresponde à chave privada
  const titular = certs.find((c) => c.publicKey.n && c.publicKey.n.equals(chave.n));
  if (!titular) throw new Error('Certificado do titular não encontrado no arquivo .pfx.');
  const cadeia = certs.filter((c) => c !== titular);

  const cn = titular.subject.getField('CN')?.value ?? '';
  return {
    chavePem: forge.pki.privateKeyToPem(chave),
    certPem: forge.pki.certificateToPem(titular),
    cadeiaPem: cadeia.map((c) => forge.pki.certificateToPem(c)),
    titular: cn,
    cnpj: (cn.match(/:(\d{14})$/) ?? [])[1] ?? null,
    validoDe: titular.validity.notBefore,
    validoAte: titular.validity.notAfter,
  };
}

/** Retorna o certificado carregado ou lança erro descritivo. */
export function obterCertificado() {
  if (cache) return cache;
  const pfx = lerPfx();
  if (!pfx) throw new Error('Certificado digital não configurado (ESOCIAL_CERT_PFX_BASE64 ou ESOCIAL_CERT_PATH).');
  try {
    cache = carregarCertificadoDePfx(pfx, process.env.ESOCIAL_CERT_SENHA);
  } catch (e) {
    throw new Error(`Não foi possível abrir o certificado digital: ${e.message}`);
  }
  if (cache.validoAte < new Date()) {
    const venc = cache.validoAte.toLocaleDateString('pt-BR');
    cache = null;
    throw new Error(`Certificado digital vencido em ${venc}.`);
  }
  return cache;
}

/** Situação do certificado para exibir na tela (não expõe chave). */
export function situacaoCertificado() {
  try {
    const c = obterCertificado();
    return { configurado: true, valido: true, titular: c.titular, cnpj: c.cnpj, validoAte: c.validoAte.toISOString() };
  } catch (e) {
    return { configurado: !!lerPfx(), valido: false, erro: e.message };
  }
}

/**
 * Assinatura XMLDSig envelopada exigida pelo eSocial: referência URI="" ao
 * elemento raiz <eSocial>, C14N, RSA-SHA256 e certificado em X509Data.
 */
export function assinarEvento(xml, certificado = obterCertificado()) {
  const sig = new SignedXml({
    privateKey: certificado.chavePem,
    publicCert: certificado.certPem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  });
  sig.addReference({
    xpath: '/*',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    uri: '',
    isEmptyUri: true,
  });
  sig.computeSignature(xml, { location: { reference: '/*', action: 'append' } });
  return sig.getSignedXml();
}
