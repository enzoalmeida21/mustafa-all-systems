import { Router } from 'express';
import {
  assignPromoterToIndustry,
  getPromoterIndustries,
  getIndustryPromoters,
  removeAssignment,
  setMyStoreIndustries,
  setPromoterStoreIndustries,
} from '../controllers/industryAssignment.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// Promotor: definir indústrias que atende em uma loja (onboarding)
router.post('/me/store/:storeId', authenticate, setMyStoreIndustries);

// Admin: definir indústrias de um promotor em uma loja
router.put('/promoter/:promoterId/store/:storeId', authenticate, requireAdmin, setPromoterStoreIndustries);

// Rotas protegidas (ADMIN ou SUPERVISOR)
router.post('/', authenticate, requireAdmin, assignPromoterToIndustry);
router.get('/promoter/me', authenticate, async (req: any, res: any) => {
  req.params.promoterId = req.userId;
  return getPromoterIndustries(req, res);
});
router.get('/promoter/:promoterId', authenticate, getPromoterIndustries);
router.get('/industry/:industryId', authenticate, getIndustryPromoters);
router.delete('/:id', authenticate, requireAdmin, removeAssignment);

export default router;

