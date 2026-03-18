import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { withRateLimit } from '../../middleware/rate-limit.js';
import db from '../../lib/db.js';

async function handler(req, res) {
  try {
    // Testa conexao com banco
    const testConn = await db.query('SELECT 1 as test');
    console.log('DB Connection OK:', testConn.rows[0]);

    // Verifica se sequencia existe
    const seqResult = await db.query(`
      SELECT sequencename 
      FROM pg_sequences 
      WHERE sequencename = 'seq_numero_inscricao'
    `);
    console.log('Sequence check:', seqResult.rows);

    if (seqResult.rows.length === 0) {
      return res.status(500).json({
        error: 'Sequencia nao criada. Execute: npm run db:migrate:inscricao'
      });
    }

    // Busca o prefixo configurado
    const prefixResult = await db.query(
      "SELECT valor FROM configuracoes WHERE chave = 'prefixo_inscricao'"
    );
    console.log('Prefix result:', prefixResult.rows);
    const prefixo = prefixResult.rows[0]?.valor || 'SDTM';

    // Gera o proximo numero da sequencia
    const numResult = await db.query('SELECT nextval($1) as numero', ['seq_numero_inscricao']);
    console.log('Numero gerado:', numResult.rows[0]);
    const numero = numResult.rows[0].numero;

    // Formata o numero com zeros a esquerda (ex: SDTM-001234)
    const numeroFormatado = `${prefixo}-${String(numero).padStart(6, '0')}`;

    return res.status(200).json({
      success: true,
      numeroInscricao: numeroFormatado,
      numeroPuro: numero
    });
  } catch (error) {
    console.error('Erro detalhado ao gerar numero de inscricao:', error);
    return res.status(500).json({
      error: 'Erro ao gerar numero de inscricao: ' + error.message
    });
  }
}

export default withSecurityHeaders(methodGuard(['GET'], withRateLimit(handler)));
