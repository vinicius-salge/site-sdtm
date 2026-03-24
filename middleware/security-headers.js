export function withSecurityHeaders(handler) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://sdtm.com.br');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.status(204).end();
    }

    return handler(req, res);
  };
}

export function methodGuard(allowedMethods, handler) {
  return async (req, res) => {
    if (!allowedMethods.includes(req.method)) {
      res.setHeader('Allow', allowedMethods.join(', '));
      return res.status(405).json({ error: `Metodo ${req.method} nao permitido` });
    }
    return handler(req, res);
  };
}
