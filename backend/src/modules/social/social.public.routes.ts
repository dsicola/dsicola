import { Router } from 'express';
import * as ctrl from './social.controller.js';

/** Rotas sem JWT: vitrine na landing dsicola.com — montado em /api/social/public */
const router = Router();

router.get('/feed', ctrl.getPublicFeed);
router.get('/posts/:id', ctrl.getPublicPost);

export default router;
