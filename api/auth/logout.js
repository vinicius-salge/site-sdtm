import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { requireAuth } from '../../middleware/auth.js';

async function handler(req, res) {
  console.log('User logged out:', req.user.id);
  return res.status(200).json({ success: true, message: 'Logout realizado com sucesso' });
}

export default withSecurityHeaders(methodGuard(['POST'], requireAuth(handler)));
