import { Router } from 'express';
import {
  getDashboard,
  getPromoterPerformance,
  getPromoterVisits,
  getPromoterRoute,
  getMissingPhotos,
  setPhotoQuota,
  exportReport,
  getPendingIndustries,
  getMyStates,
  getPendingOverview,
  getScopedPromoters,
  getPromoterMissHistory,
} from '../controllers/supervisor.controller';
import { getPromoters } from '../controllers/promoters.controller';
import { downloadExport, getExportStatus } from '../controllers/export.controller';
import {
  setPromoterRoute,
  addStoresToRoute,
  removeStoreFromRoute,
  updateRouteAssignmentSupervisor,
  getPromoterRoute as getPromoterRouteAssignment,
  getAllRoutes,
  getAvailableStores,
  updateStoreHours,
  getPromoterHoursReport,
  getAllPromotersHoursReport,
} from '../controllers/route.controller';
import {
  createStore,
  bulkCreateStores,
  updateStore,
  deleteStore,
  getAllStores,
  getStore,
} from '../controllers/store.controller';
import { authenticate, requireAdmin, requireSupervisor, AuthRequest } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

// Todas as rotas abaixo requerem autenticação
router.use(authenticate);

// 🔒 Rotas de dashboard e relatórios - acessíveis para SUPERVISOR e ADMIN
router.get('/dashboard', requireSupervisor, getDashboard);
router.get('/my-states', requireSupervisor, getMyStates);
router.get('/pending-overview', requireSupervisor, getPendingOverview);
router.get('/promoters', requireSupervisor, getScopedPromoters);
router.get('/promoters/:id/performance', requireSupervisor, getPromoterPerformance);
router.get('/promoters/:id/visits', requireSupervisor, getPromoterVisits);
router.get('/promoters/:id/miss-history', requireSupervisor, getPromoterMissHistory);
router.get('/promoters/:id/route', requireSupervisor, getPromoterRoute); // Rota histórica (visitas do dia)
router.get('/missing-photos', requireSupervisor, getMissingPhotos);
router.get('/pending-industries', requireSupervisor, getPendingIndustries);
router.put('/promoters/:id/photo-quota', requireSupervisor, setPhotoQuota);
router.post('/export/report', requireSupervisor, exportReport);
router.get('/export/status/:id', requireSupervisor, getExportStatus);
router.get('/export/download/:id', requireSupervisor, downloadExport);

// 🔒 Configuração de rotas: supervisor (escopo) ou admin
router.post('/promoters/:promoterId/route-assignment', requireSupervisor, setPromoterRoute);
router.post('/promoters/:promoterId/route-assignment/add', requireSupervisor, addStoresToRoute);
router.delete('/promoters/:promoterId/route-assignment/:storeId', requireSupervisor, removeStoreFromRoute);
router.patch('/promoters/:promoterId/route-assignment/:storeId/supervisor', requireAdmin, updateRouteAssignmentSupervisor);
router.get(
  '/promoters/:promoterId/route-assignment',
  requireSupervisor,
  getPromoterRouteAssignment
);
router.put(
  '/promoters/:promoterId/stores/:storeId/hours',
  requireSupervisor,
  updateStoreHours
);
router.get('/promoters/:promoterId/hours-report', requireAdmin, getPromoterHoursReport);
router.get('/promoters/hours-report', requireAdmin, getAllPromotersHoursReport);
router.get('/routes', requireSupervisor, getAllRoutes);
router.get('/supervisors-list', requireSupervisor, async (req: AuthRequest, res) => {
  try {
    const prisma = (await import('../prisma/client')).default;
    const isAdmin = req.userRole === UserRole.ADMIN;
    const supervisors = await prisma.user.findMany({
      where: isAdmin
        ? { role: UserRole.SUPERVISOR }
        : { id: req.userId!, role: UserRole.SUPERVISOR },
      select: { id: true, name: true, email: true, state: true },
      orderBy: { name: 'asc' },
    });
    res.json({ supervisors });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.get('/stores/available', requireSupervisor, getAvailableStores);

// 🔒 Rotas de gerenciamento de lojas - SUPERVISOR e ADMIN
router.get('/stores', requireSupervisor, getAllStores);
router.get('/stores/:id', requireSupervisor, getStore);
router.post('/stores', requireSupervisor, createStore);
router.post('/stores/bulk', requireSupervisor, bulkCreateStores);
router.put('/stores/:id', requireSupervisor, updateStore);
router.delete('/stores/:id', requireSupervisor, deleteStore);

export default router;

