import { Router } from 'express';
import * as ctrl from './community.controller.js';
import { attachCommunityViewer } from './community.optionalUser.js';
import { authenticate } from '../../middlewares/auth.js';

const router = Router();

router.get('/institutions', ctrl.listInstitutions);
router.get('/institutions/:id/ratings', ctrl.listInstitutionRatings);
router.get('/institutions/:id', attachCommunityViewer, ctrl.getInstitution);
router.post('/institutions/:id/ratings', authenticate, ctrl.submitInstitutionRating);
router.get('/courses', ctrl.listCourses);
router.post('/follow', authenticate, ctrl.follow);
router.delete('/follow/:instituicaoId', authenticate, ctrl.unfollow);

export default router;
