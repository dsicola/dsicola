import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { requireComunidadePlano } from './socialPlan.middleware.js';
import * as ctrl from './social.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireComunidadePlano);

router.get('/groups', ctrl.getGroups);
router.post('/groups', ctrl.postGroup);
router.post('/groups/:id/join', ctrl.postJoinGroup);
router.delete('/groups/:id/membership', ctrl.postLeaveGroup);

router.get('/overview', ctrl.getFeedOverview);
router.get('/feed', ctrl.getFeed);
router.get('/posts', ctrl.listPosts);
router.post('/posts', ctrl.postCreate);
router.get('/posts/:id', ctrl.getPost);
router.patch('/posts/:id', ctrl.postUpdate);
router.delete('/posts/:id', ctrl.postDelete);

router.post('/posts/:id/view', ctrl.postView);

router.get('/posts/:id/comments', ctrl.getComments);
router.post('/posts/:id/comments', ctrl.postComment);
router.patch('/posts/:postId/comments/:commentId', ctrl.patchComment);
router.delete('/posts/:postId/comments/:commentId', ctrl.deleteComment);

router.post('/posts/:id/reactions', ctrl.putReaction);
router.delete('/posts/:id/reactions', ctrl.deleteReaction);

router.post('/users/:userId/follow', ctrl.follow);
router.delete('/users/:userId/follow', ctrl.unfollow);

export default router;
