import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function generateFichaCadastral(dados) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const drawText = (text, x, currentY, options = {}) => {
    page.drawText(text || '', {
      x,
      y: currentY,
      size: options.size || 10,
      font: options.bold ? fontBold : font,
      color: options.color || rgb(0.1, 0.1, 0.1),
    });
  };

  const drawLine = (currentY) => {
    page.drawLine({
      start: { x: margin, y: currentY },
      end: { x: width - margin, y: currentY },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
  };

  // Header
  drawText('SDTM - Sindicato dos Despachantes do Triangulo Mineiro', margin, y, { size: 14, bold: true });
  y -= 20;
  drawText('Ficha de Cadastro do Associado', margin, y, { size: 11, color: rgb(0.4, 0.4, 0.4) });
  y -= 10;
  drawLine(y);
  y -= 25;

  // Inscription number
  if (dados.numeroInscricao) {
    drawText(`Inscricao N.: ${dados.numeroInscricao}`, margin, y, { size: 11, bold: true });
    y -= 25;
  }

  // Personal data section
  drawText('DADOS PESSOAIS', margin, y, { size: 11, bold: true, color: rgb(0.12, 0.25, 0.69) });
  y -= 20;

  const fields = [
    ['Nome Completo', dados.nome],
    ['Pai', dados.pai],
    ['Mae', dados.mae],
    ['CPF', dados.cpf],
    ['RG', dados.rg],
    ['Orgao Emissor', dados.ssp],
    ['Estado Civil', dados.estadoCivil],
    ['Data de Nascimento', dados.dataNascimento],
    ['Naturalidade', dados.naturalidade],
    ['Nacionalidade', dados.nacionalidade],
  ];

  for (const [label, value] of fields) {
    if (value) {
      drawText(`${label}:`, margin, y, { size: 9, bold: true });
      drawText(String(value), margin + 120, y, { size: 9 });
      y -= 16;
    }
  }

  // Address
  if (dados.endereco || dados.cidade) {
    y -= 10;
    drawText('ENDERECO', margin, y, { size: 11, bold: true, color: rgb(0.12, 0.25, 0.69) });
    y -= 20;

    const addressFields = [
      ['Endereco', dados.endereco],
      ['Bairro', dados.bairro],
      ['Cidade', dados.cidade],
      ['UF', dados.uf],
      ['CEP', dados.cep],
    ];

    for (const [label, value] of addressFields) {
      if (value) {
        drawText(`${label}:`, margin, y, { size: 9, bold: true });
        drawText(String(value), margin + 120, y, { size: 9 });
        y -= 16;
      }
    }
  }

  // Commercial data
  if (dados.empresa || dados.cnpj) {
    y -= 10;
    drawText('DADOS COMERCIAIS', margin, y, { size: 11, bold: true, color: rgb(0.12, 0.25, 0.69) });
    y -= 20;

    const commercialFields = [
      ['Empresa', dados.empresa],
      ['CNPJ', dados.cnpj],
      ['Endereco Comercial', dados.enderecoComercial],
      ['Telefone Comercial', dados.telefoneComercial],
      ['Celular', dados.celular],
    ];

    for (const [label, value] of commercialFields) {
      if (value) {
        drawText(`${label}:`, margin, y, { size: 9, bold: true });
        drawText(String(value), margin + 120, y, { size: 9 });
        y -= 16;
      }
    }
  }

  // Footer
  const footerY = 60;
  drawLine(footerY + 10);
  drawText(`Documento gerado em ${new Date().toLocaleDateString('pt-BR')}`, margin, footerY, {
    size: 8,
    color: rgb(0.6, 0.6, 0.6),
  });
  drawText('Este documento e criptografado e protegido por senha.', margin, footerY - 12, {
    size: 8,
    color: rgb(0.6, 0.6, 0.6),
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
