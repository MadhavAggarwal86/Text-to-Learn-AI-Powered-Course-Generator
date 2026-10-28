import { Router } from 'express';
import { User } from '../models/index.js';

export function createUserRouter() {
  const router = Router();

  /** GET /api/users/me: the signed-in user's profile (just the id for the dev user). */
  router.get('/me', async (req, res) => {
    const user = await User.findOne({ sub: req.user.sub });
    res.json(user ?? { sub: req.user.sub });
  });

  return router;
}
