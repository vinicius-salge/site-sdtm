import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { withRateLimit } from '../../middleware/rate-limit.js';
import db from '../../lib/db.js';

async function handler(req, res) {
  try {
    const result = await db.query("SELECT nextval('seq_numero_inscricao') as next_num");
    const nextNum = parseInt(result.rows[0].next_num);
    const prefixo = process.env.INSCRICAO_PREFIX || 'SDTM';
    const numeroFormatado = `${prefixo}-${String(nextNum).padStart(6, '0')}`;

    console.log(JSON.stringify({ action: 'GENERATE_INSCRICAO', numero: numeroFormatado }));

    return res.status(200).json({
      success: true,
      numeroInscricao: numeroFormatado,
      numeroPuro: nextNum,
    });
  } catch (error) {
    console.error(JSON.stringify({ action: 'GENERATE_INSCRICAO', error: error.message }));
    return res.status(500).json({
      error: 'Erro interno ao gerar numero de inscricao',
    });
  }
}

export default withSecurityHeaders(methodGuard(['GET'], withRateLimit(handler)));
