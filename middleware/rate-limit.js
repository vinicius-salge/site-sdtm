import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let ratelimit = null;

function getRateLimiter() {
  if (ratelimit) return ratelimit;

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  ratelimit = new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    analytics: true,
  });

  return ratelimit;
}

export function withRateLimit(handler) {
  return async (req, res) => {
    const limiter = getRateLimiter();

    if (!limiter) {
      return handler(req, res);
    }

    const identifier = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anonymous';
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', reset);

    if (!success) {
      return res.status(429).json({
        error: 'Muitas tentativas. Tente novamente em alguns minutos.',
      });
    }

    return handler(req, res);
  };
}
