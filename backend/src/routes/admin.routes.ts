import { Router } from 'express';
import { 
  seedDatabase, 
  listUsers, 
  createUser, 
  updateUser, 
  deleteUser, 
  getUser,
  setSupervisorRegions,
  getSupervisorRegions,
  setPromoterSupervisors,
  getPromoterSupervisors,
} from '../controllers/admin.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.post('/seed', seedDatabase);

router.get('/users', authenticate, requireAdmin, listUsers);
router.post('/users', authenticate, requireAdmin, createUser);
router.get('/users/:id', authenticate, requireAdmin, getUser);
router.put('/users/:id', authenticate, requireAdmin, updateUser);
router.delete('/users/:id', authenticate, requireAdmin, deleteUser);

router.get('/supervisors/:id/regions', authenticate, requireAdmin, getSupervisorRegions);
router.post('/supervisors/:id/regions', authenticate, requireAdmin, setSupervisorRegions);

router.get('/promoters/:id/supervisors', authenticate, requireAdmin, getPromoterSupervisors);
router.post('/promoters/:id/supervisors', authenticate, requireAdmin, setPromoterSupervisors);

export default router;

