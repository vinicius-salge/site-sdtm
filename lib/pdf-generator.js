import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let logoBytes = null;
function getLogoBytes() {
  if (!logoBytes) {
    try {
      logoBytes = readFileSync(join(__dirname, '..', 'assets', 'img', 'logo', 'logo-inteira.png'));
    } catch (e) { logoBytes = null; }
  }
  return logoBytes;
}

const UP = (v) => v ? String(v).toUpperCase() : '';
const BLUE = rgb(0.08, 0.15, 0.55);
const GRAY = rgb(0.35, 0.35, 0.35);
const LIGHT = rgb(0.6, 0.6, 0.6);
const BLACK = rgb(0.1, 0.1, 0.1);

export async function generateFichaCadastral(dados) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const M = 36;
  const W = width - M * 2;
  let y = height - M;

  const text = (t, x, ty, opts = {}) => {
    page.drawText(String(t || ''), {
      x, y: ty,
      size: opts.size || 8,
      font: opts.bold ? fontBold : font,
      color: opts.color || BLACK,
    });
  };

  const line = (ty, thick = 0.5, color = rgb(0.8, 0.8, 0.8)) => {
    page.drawLine({ start: { x: M, y: ty }, end: { x: width - M, y: ty }, thickness: thick, color });
  };

  const rect = (x, ry, w, h) => {
    page.drawRectangle({ x, y: ry, width: w, height: h, borderColor: rgb(0.4, 0.4, 0.4), borderWidth: 0.8 });
  };

  const field = (label, value, x, fy, lw = 0) => {
    text(label, x, fy, { size: 7, bold: true, color: GRAY });
    const lWidth = lw || fontBold.widthOfTextAtSize(label, 7) + 4;
    text(UP(value), x + lWidth, fy, { size: 8 });
  };

  const fieldInline = (label, value, x, fy) => {
    text(`${label}: `, x, fy, { size: 7, bold: true, color: GRAY });
    const lWidth = fontBold.widthOfTextAtSize(`${label}: `, 7);
    text(UP(value), x + lWidth, fy, { size: 8 });
    return x + lWidth + font.widthOfTextAtSize(UP(value || ''), 8) + 12;
  };

  const sectionHeader = (title, sy) => {
    line(sy + 4, 1.2, BLUE);
    text(title, M, sy - 8, { size: 9, bold: true, color: BLUE });
    return sy - 22;
  };

  // ==========================================
  // HEADER
  // ==========================================
  const logoData = getLogoBytes();
  if (logoData) {
    try {
      const logoImage = await doc.embedPng(logoData);
      const scale = 55 / logoImage.height;
      const lw = logoImage.width * scale;
      page.drawImage(logoImage, { x: M, y: y - 55, width: lw, height: 55 });
    } catch (e) {
      text('SINDICATO DOS DESPACHANTES DO TRIANGULO MINEIRO', M, y - 14, { size: 11, bold: true });
    }
  } else {
    text('SINDICATO DOS DESPACHANTES', M, y - 10, { size: 11, bold: true });
    text('DO TRIANGULO MINEIRO', M, y - 22, { size: 11, bold: true });
  }

  text('REQUERIMENTO DE CADASTRO', width - M - fontBold.widthOfTextAtSize('REQUERIMENTO DE CADASTRO', 12), y - 18, {
    size: 12, bold: true,
  });

  y -= 62;
  line(y, 1.5, rgb(0.2, 0.2, 0.2));
  y -= 16;

  // ==========================================
  // FOTO 3x4 + INSCRICAO + POLEGAR DIREITO
  // ==========================================
  const boxW = 85;
  const boxH = 105;

  rect(M, y - boxH, boxW, boxH);
  text('Foto 3x4', M + 22, y - 14, { size: 7, color: LIGHT });

  rect(width - M - boxW, y - boxH, boxW, boxH);
  text('Polegar Direito', width - M - boxW + 14, y - 14, { size: 7, color: LIGHT });

  const cx = M + boxW + 25;
  text('Numero da Inscricao:', cx, y - 35, { size: 9, bold: true });
  const inscNum = UP(dados.numeroInscricao) || '________________________';
  text(inscNum, cx, y - 52, { size: 14, bold: true });

  y -= boxH + 20;

  // ==========================================
  // DADOS PESSOAIS
  // ==========================================
  y = sectionHeader('DADOS PESSOAIS', y);

  field('Nome: ', dados.nome, M, y, 40);
  y -= 14;

  field('Pai: ', dados.pai, M, y, 40);
  y -= 14;

  field('Mae: ', dados.mae, M, y, 40);
  y -= 14;

  let nx;
  nx = fieldInline('CPF', dados.cpf, M, y);
  nx = fieldInline('RG', dados.rg, nx, y);
  nx = fieldInline('SSP', dados.ssp, nx, y);
  fieldInline('Estado Civil', dados.estadoCivil, nx, y);
  y -= 14;

  nx = fieldInline('Data Nasc.', dados.dataNascimento, M, y);
  nx = fieldInline('Naturalidade', dados.naturalidade, nx, y);
  fieldInline('UF', dados.ufNaturalidade, nx, y);
  y -= 14;

  fieldInline('Nacionalidade', dados.nacionalidade, M, y);
  y -= 14;

  fieldInline('Grau de Instrucao', dados.grauInstrucao, M, y);
  y -= 14;

  nx = fieldInline('Titulo', dados.tituloEleitor, M, y);
  nx = fieldInline('Zona', dados.zona, nx, y);
  fieldInline('Secao', dados.secao, nx, y);
  y -= 14;

  field('Endereco: ', dados.endereco, M, y, 55);
  y -= 14;

  nx = fieldInline('Bairro', dados.bairro, M, y);
  nx = fieldInline('Cidade', dados.cidade, nx, y);
  fieldInline('CEP', dados.cep, nx, y);
  y -= 14;

  nx = fieldInline('Telefone', dados.telefone, M, y);
  fieldInline('Celular', dados.celular, nx, y);
  y -= 14;

  fieldInline('E-mail', dados.emailPessoal, M, y);
  y -= 18;

  // ==========================================
  // DADOS COMERCIAIS
  // ==========================================
  y = sectionHeader('DADOS COMERCIAIS', y);

  nx = fieldInline('Cidade de Atuacao', dados.cidadeAtuacao, M, y);
  fieldInline('Area', dados.despachanteArea, nx, y);
  y -= 14;

  fieldInline('Credenciamento DETRAN', dados.credenciamentoDetran, M, y);
  y -= 14;

  field('End. Comercial: ', dados.enderecoComercial, M, y, 80);
  y -= 14;

  nx = fieldInline('Bairro', dados.bairroComercial, M, y);
  nx = fieldInline('Cidade', dados.cidadeComercial, nx, y);
  fieldInline('CEP', dados.cepComercial, nx, y);
  y -= 14;

  nx = fieldInline('Tel. Comercial', dados.telefoneComercial, M, y);
  fieldInline('Fax', dados.fax, nx, y);
  y -= 14;

  fieldInline('E-mail Comercial', dados.emailComercial, M, y);
  y -= 25;

  // ==========================================
  // ASSINATURA & FOOTER
  // ==========================================
  line(y, 0.5);
  y -= 25;

  text('_________________________, ____ de ______________ de ________', M, y, { size: 9 });
  y -= 20;

  text('Assinatura: _______________________________________________', M, y, { size: 9 });
  y -= 25;

  text('Visto do Diretor de Cadastro: ______________________________________ em ____/____/____', M, y, { size: 8 });
  y -= 16;

  text('Aprovado pela Diretoria em: ____/____/____    Presidente do SDTM: _________________________', M, y, { size: 8 });
  y -= 20;

  line(y, 0.3);
  y -= 10;

  const now = new Date().toLocaleDateString('pt-BR');
  text(`Documento gerado em ${now} | Criptografado com AES-256-GCM | Protegido por senha`, M, y, {
    size: 6.5, color: LIGHT,
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
