import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { withRateLimit } from '../../middleware/rate-limit.js';
import db from '../../lib/db.js';

async function handler(req, res) {
  try {
    // Busca o maior numero de inscricao ja usado
    const result = await db.query(`
      SELECT numero_inscricao 
      FROM users 
      WHERE numero_inscricao IS NOT NULL 
      ORDER BY numero_inscricao DESC 
      LIMIT 1
    `);

    let proximoNumero = 1000; // Numero inicial padrao

    if (result.rows.length > 0) {
      // Extrai o numero da string (ex: "SDTM-001005" -> 1005)
      const ultimoNumero = result.rows[0].numero_inscricao;
      const match = ultimoNumero.match(/(\d+)$/);
      if (match) {
        proximoNumero = parseInt(match[1]) + 1;
      }
    }

    // Busca o prefixo configurado
    const prefixResult = await db.query(
      "SELECT valor FROM configuracoes WHERE chave = 'prefixo_inscricao'"
    );
    const prefixo = prefixResult.rows[0]?.valor || 'SDTM';

    // Formata o numero com zeros a esquerda (ex: SDTM-001002)
    const numeroFormatado = `${prefixo}-${String(proximoNumero).padStart(6, '0')}`;

    console.log('Proximo numero gerado:', numeroFormatado);

    return res.status(200).json({
      success: true,
      numeroInscricao: numeroFormatado,
      numeroPuro: proximoNumero
    });
  } catch (error) {
    console.error('Erro ao gerar numero de inscricao:', error);
    return res.status(500).json({
      error: 'Erro ao gerar numero de inscricao: ' + error.message
    });
  }
}

export default withSecurityHeaders(methodGuard(['GET'], withRateLimit(handler)));
