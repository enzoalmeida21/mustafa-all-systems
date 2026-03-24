import prisma from '../prisma/client';
import { UserRole } from '../types';

/**
 * Promotor visível ao supervisor (mesma regra de getScopedPromoters).
 */
export async function isPromoterInSupervisorScope(
  supervisorId: string,
  promoterId: string
): Promise<boolean> {
  const promoter = await prisma.user.findFirst({
    where: {
      id: promoterId,
      role: UserRole.PROMOTER,
      OR: [
        { promoterSupervisors: { some: { supervisorId } } },
        { routeAssignments: { some: { supervisorId, isActive: true } } },
      ],
    },
    select: { id: true },
  });
  return !!promoter;
}

/**
 * Supervisor pode definir indústrias do promotor na loja se:
 * - há rota ativa promotor+loja com supervisorId = ele, ou
 * - rota sem supervisor mas promotor está vinculado a ele (PromoterSupervisor).
 */
export async function supervisorCanSetIndustriesForPromoterStore(
  supervisorId: string,
  promoterId: string,
  storeId: string
): Promise<boolean> {
  const assignment = await prisma.routeAssignment.findFirst({
    where: { promoterId, storeId, isActive: true },
  });
  if (!assignment) return false;

  if (assignment.supervisorId === supervisorId) return true;

  if (assignment.supervisorId === null) {
    const link = await prisma.promoterSupervisor.findFirst({
      where: { promoterId, supervisorId },
    });
    return !!link;
  }

  return false;
}
