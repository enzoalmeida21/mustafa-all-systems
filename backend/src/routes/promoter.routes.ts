import { Router } from 'express';
import {
  checkIn,
  checkOut,
  uploadPhotos,
  submitPriceResearch,
  getCurrentVisit,
  getStores,
  getVisits,
  getDailySummary,
  getVisitCoverage,
  getVisitIndustries,
} from '../controllers/promoter.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/stores', getStores);
router.get('/visits', getVisits);
router.post('/checkin', checkIn);
router.post('/checkout', checkOut);
router.post('/photos', uploadPhotos);
router.post('/price-research', submitPriceResearch);
router.get('/current-visit', getCurrentVisit);
router.get('/daily-summary', getDailySummary);
router.get('/visits/:visitId/coverage', getVisitCoverage);
router.get('/visits/:visitId/industries', getVisitIndustries);

export default router;

