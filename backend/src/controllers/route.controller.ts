import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma/client';

const createRouteSchema = z.object({
  storeIds: z.array(z.string().uuid()).min(1, 'Selecione pelo menos uma loja'),
  orders: z.array(z.number().int().min(0)).optional(),
  expectedHours: z.record(z.string().uuid(), z.number()).optional(),
  supervisorId: z.string().uuid().optional().nullable(),
});

const updateRouteSchema = z.object({
  storeIds: z.array(z.string().uuid()).min(1, 'Selecione pelo menos uma loja'),
  orders: z.array(z.number().int().min(0)).optional(),
});

// Criar ou atualizar rota de um promotor
export async function setPromoterRoute(req: AuthRequest, res: Response) {
  try {
    const { promoterId } = req.params;
    
    // Validar UUID do promoterId
    if (!z.string().uuid().safeParse(promoterId).success) {
      return res.status(400).json({ message: 'ID do promotor inválido' });
    }

    const { storeIds, orders, expectedHours, supervisorId } = createRouteSchema.parse(req.body);

    const promoter = await prisma.user.findUnique({
      where: { id: promoterId },
    });

    if (!promoter || promoter.role !== 'PROMOTER') {
      return res.status(404).json({ message: 'Promotor não encontrado' });
    }

    const stores = await prisma.store.findMany({
      where: { id: { in: storeIds } },
    });

    if (stores.length !== storeIds.length) {
      return res.status(400).json({ message: 'Uma ou mais lojas não foram encontradas' });
    }

    await prisma.routeAssignment.deleteMany({
      where: { promoterId },
    });

    const assignments = await Promise.all(
      storeIds.map((storeId, index) =>
        prisma.routeAssignment.create({
          data: {
            promoterId,
            storeId,
            order: orders?.[index] ?? index,
            expectedHours: expectedHours?.[storeId] || null,
            isActive: true,
            supervisorId: supervisorId || null,
          },
          include: {
            store: true,
          },
        })
      )
    );

    res.json({
      message: 'Rota configurada com sucesso',
      route: {
        promoter: {
          id: promoter.id,
          name: promoter.name,
          email: promoter.email,
        },
        stores: assignments.map((a) => ({
          id: a.store.id,
          name: a.store.name,
          address: a.store.address,
          order: a.order,
        })),
        totalStores: assignments.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Set promoter route error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Adicionar lojas à rota existente de um promotor (sem remover as atuais)
 */
export async function addStoresToRoute(req: AuthRequest, res: Response) {
  try {
    const { promoterId } = req.params;
    if (!z.string().uuid().safeParse(promoterId).success) {
      return res.status(400).json({ message: 'ID do promotor inválido' });
    }

    const { storeIds, supervisorId } = z.object({
      storeIds: z.array(z.string().uuid()).min(1, 'Selecione pelo menos uma loja'),
      supervisorId: z.string().uuid().optional().nullable(),
    }).parse(req.body);

    const promoter = await prisma.user.findUnique({ where: { id: promoterId } });
    if (!promoter || promoter.role !== 'PROMOTER') {
      return res.status(404).json({ message: 'Promotor não encontrado' });
    }

    const stores = await prisma.store.findMany({ where: { id: { in: storeIds } } });
    if (stores.length !== storeIds.length) {
      return res.status(400).json({ message: 'Uma ou mais lojas não foram encontradas' });
    }

    if (supervisorId) {
      const supervisor = await prisma.user.findUnique({ where: { id: supervisorId } });
      if (!supervisor || supervisor.role !== 'SUPERVISOR') {
        return res.status(400).json({ message: 'Supervisor não encontrado' });
      }
    }

    const existing = await prisma.routeAssignment.findMany({
      where: { promoterId, isActive: true },
      orderBy: { order: 'desc' },
    });
    const existingStoreIds = new Set(existing.map(a => a.storeId));
    const maxOrder = existing.length > 0 ? existing[0].order : -1;

    const newStoreIds = storeIds.filter(id => !existingStoreIds.has(id));
    if (newStoreIds.length === 0) {
      return res.json({ message: 'Todas as lojas já estão atribuídas', added: 0 });
    }

    await Promise.all(
      newStoreIds.map((storeId, index) =>
        prisma.routeAssignment.create({
          data: {
            promoterId,
            storeId,
            order: maxOrder + 1 + index,
            isActive: true,
            supervisorId: supervisorId || null,
          },
        })
      )
    );

    res.json({ message: `${newStoreIds.length} loja(s) adicionada(s)`, added: newStoreIds.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Add stores to route error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Remover uma loja específica da rota de um promotor
 */
export async function removeStoreFromRoute(req: AuthRequest, res: Response) {
  try {
    const { promoterId, storeId } = req.params;

    const assignment = await prisma.routeAssignment.findUnique({
      where: { promoterId_storeId: { promoterId, storeId } },
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Atribuição não encontrada' });
    }

    await prisma.routeAssignment.delete({ where: { id: assignment.id } });

    res.json({ message: 'Loja removida da rota' });
  } catch (error) {
    console.error('Remove store from route error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Obter rota de um promotor
export async function getPromoterRoute(req: AuthRequest, res: Response) {
  try {
    const { promoterId } = req.params;

    const promoter = await prisma.user.findUnique({
      where: { id: promoterId },
    });

    if (!promoter || promoter.role !== 'PROMOTER') {
      return res.status(404).json({ message: 'Promotor não encontrado' });
    }

    const assignments = await prisma.routeAssignment.findMany({
      where: {
        promoterId,
        isActive: true,
      },
      include: {
        store: true,
      },
      orderBy: {
        order: 'asc',
      },
    });

    res.json({
      promoter: {
        id: promoter.id,
        name: promoter.name,
        email: promoter.email,
      },
      route: assignments.map((a: any) => ({
        id: a.id,
        store: {
          id: a.store.id,
          name: a.store.name,
          address: a.store.address,
          latitude: a.store.latitude,
          longitude: a.store.longitude,
        },
        order: a.order,
        expectedHours: a.expectedHours,
        isActive: a.isActive,
      })),
      totalStores: assignments.length,
    });
  } catch (error) {
    console.error('Get promoter route error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Listar todas as rotas (para supervisor)
export async function getAllRoutes(req: AuthRequest, res: Response) {
  try {
    const promoters = await prisma.user.findMany({
      where: { role: 'PROMOTER' },
      include: {
        routeAssignments: {
          where: { isActive: true },
          include: {
            store: true,
            supervisor: {
              select: { id: true, name: true },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    const routes = promoters.map((promoter: any) => ({
      promoter: {
        id: promoter.id,
        name: promoter.name,
        email: promoter.email,
      },
      stores: promoter.routeAssignments.map((a: any) => ({
        id: a.id,
        store: {
          id: a.store.id,
          name: a.store.name,
          address: a.store.address,
        },
        order: a.order,
        expectedHours: a.expectedHours,
        supervisor: a.supervisor ? { id: a.supervisor.id, name: a.supervisor.name } : null,
      })),
      totalStores: promoter.routeAssignments.length,
    }));

    res.json({ routes });
  } catch (error) {
    console.error('Get all routes error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Atualizar o supervisor de uma atribuição de rota existente
 */
export async function updateRouteAssignmentSupervisor(req: AuthRequest, res: Response) {
  try {
    const { promoterId, storeId } = req.params;
    const { supervisorId } = z.object({
      supervisorId: z.string().uuid().nullable(),
    }).parse(req.body);

    const assignment = await prisma.routeAssignment.findUnique({
      where: { promoterId_storeId: { promoterId, storeId } },
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Atribuição não encontrada' });
    }

    if (supervisorId) {
      const supervisor = await prisma.user.findUnique({ where: { id: supervisorId } });
      if (!supervisor || supervisor.role !== 'SUPERVISOR') {
        return res.status(400).json({ message: 'Supervisor não encontrado' });
      }
    }

    const updated = await prisma.routeAssignment.update({
      where: { id: assignment.id },
      data: { supervisorId },
      include: {
        supervisor: { select: { id: true, name: true } },
      },
    });

    res.json({
      message: 'Supervisor atualizado',
      supervisor: updated.supervisor ? { id: updated.supervisor.id, name: updated.supervisor.name } : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Update route assignment supervisor error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Obter lojas disponíveis para atribuição
export async function getAvailableStores(req: AuthRequest, res: Response) {
  try {
    const stores = await prisma.store.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    res.json({ stores });
  } catch (error) {
    console.error('Get available stores error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Atualizar horas esperadas de uma loja específica
export async function updateStoreHours(req: AuthRequest, res: Response) {
  try {
    const { promoterId, storeId } = req.params;
    const { expectedHours } = req.body;

    if (expectedHours !== undefined && (typeof expectedHours !== 'number' || expectedHours < 0)) {
      return res.status(400).json({ message: 'Horas esperadas deve ser um número positivo' });
    }

    const assignment = await prisma.routeAssignment.findUnique({
      where: {
        promoterId_storeId: {
          promoterId,
          storeId,
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Atribuição não encontrada' });
    }

    const updated = await prisma.routeAssignment.update({
      where: {
        id: assignment.id,
      },
      data: {
        expectedHours: expectedHours !== undefined ? expectedHours : null,
      },
      include: {
        store: true,
      },
    });

    res.json({ assignment: updated });
  } catch (error) {
    console.error('Update store hours error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Relatório de horas trabalhadas vs esperadas por promotor
export async function getPromoterHoursReport(req: AuthRequest, res: Response) {
  try {
    const { promoterId } = req.params;
    const { startDate, endDate } = req.query;

    const promoter = await prisma.user.findUnique({
      where: { id: promoterId },
    });

    if (!promoter || promoter.role !== 'PROMOTER') {
      return res.status(404).json({ message: 'Promotor não encontrado' });
    }

    const assignments = await prisma.routeAssignment.findMany({
      where: {
        promoterId,
        isActive: true,
      },
      include: {
        store: true,
      },
    });

    const where: any = {
      promoterId,
    };

    if (startDate || endDate) {
      where.checkInAt = {};
      if (startDate) {
        where.checkInAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.checkInAt.lte = new Date(endDate as string);
      }
    }

    const visits = await prisma.visit.findMany({
      where,
      select: {
        id: true,
        storeId: true,
        checkInAt: true,
        checkOutAt: true,
      },
    });

    // Calcular horas trabalhadas por loja
    const workedHoursByStore: Record<string, number> = {};
    visits.forEach((visit: { storeId: string; checkInAt: Date; checkOutAt: Date | null }) => {
      if (visit.checkOutAt) {
        const hours = (visit.checkOutAt.getTime() - visit.checkInAt.getTime()) / (1000 * 60 * 60);
        workedHoursByStore[visit.storeId] = (workedHoursByStore[visit.storeId] || 0) + hours;
      }
    });

    const report = assignments.map((assignment: any) => {
      const workedHours = workedHoursByStore[assignment.storeId] || 0;
      const expectedHours = assignment.expectedHours || 0;
      const difference = workedHours - expectedHours;
      const percentage = expectedHours > 0 ? (workedHours / expectedHours) * 100 : 0;

      return {
        assignmentId: assignment.id,
        store: {
          id: assignment.store.id,
          name: assignment.store.name,
          address: assignment.store.address,
        },
        expectedHours,
        workedHours: Math.round(workedHours * 100) / 100,
        difference: Math.round(difference * 100) / 100,
        percentage: Math.round(percentage * 100) / 100,
        status: expectedHours > 0
          ? percentage >= 100
            ? 'complete'
            : percentage >= 80
            ? 'warning'
            : 'incomplete'
          : 'no_target',
      };
    });

    const totalExpected = report.reduce((sum: number, r: any) => sum + r.expectedHours, 0);
    const totalWorked = report.reduce((sum: number, r: any) => sum + r.workedHours, 0);
    const totalDifference = totalWorked - totalExpected;
    const totalPercentage = totalExpected > 0 ? (totalWorked / totalExpected) * 100 : 0;

    res.json({
      promoter: {
        id: promoter.id,
        name: promoter.name,
        email: promoter.email,
      },
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      stores: report,
      summary: {
        totalExpected: Math.round(totalExpected * 100) / 100,
        totalWorked: Math.round(totalWorked * 100) / 100,
        totalDifference: Math.round(totalDifference * 100) / 100,
        totalPercentage: Math.round(totalPercentage * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Get promoter hours report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Relatório consolidado de todos os promotores
export async function getAllPromotersHoursReport(req: AuthRequest, res: Response) {
  try {
    const { startDate, endDate } = req.query;

    const promoters = await prisma.user.findMany({
      where: { role: 'PROMOTER' },
      include: {
        routeAssignments: {
          where: { isActive: true },
          include: {
            store: true,
          },
        },
      },
    });

    const where: any = {};
    if (startDate || endDate) {
      where.checkInAt = {};
      if (startDate) {
        where.checkInAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.checkInAt.lte = new Date(endDate as string);
      }
    }

    const allVisits = await prisma.visit.findMany({
      where,
      select: {
        promoterId: true,
        storeId: true,
        checkInAt: true,
        checkOutAt: true,
      },
    });

    // Calcular horas trabalhadas por promotor e loja
    const workedHoursByPromoterStore: Record<string, Record<string, number>> = {};
    allVisits.forEach((visit: { promoterId: string; storeId: string; checkInAt: Date; checkOutAt: Date | null }) => {
      if (visit.checkOutAt) {
        const hours = (visit.checkOutAt.getTime() - visit.checkInAt.getTime()) / (1000 * 60 * 60);
        if (!workedHoursByPromoterStore[visit.promoterId]) {
          workedHoursByPromoterStore[visit.promoterId] = {};
        }
        workedHoursByPromoterStore[visit.promoterId][visit.storeId] =
          (workedHoursByPromoterStore[visit.promoterId][visit.storeId] || 0) + hours;
      }
    });

    const report = promoters.map((promoter: any) => {
      const promoterWorkedHours = workedHoursByPromoterStore[promoter.id] || {};
      let totalExpected = 0;
      let totalWorked = 0;

      promoter.routeAssignments.forEach((assignment: any) => {
        const expected = assignment.expectedHours || 0;
        const worked = promoterWorkedHours[assignment.storeId] || 0;
        totalExpected += expected;
        totalWorked += worked;
      });

      const totalDifference = totalWorked - totalExpected;
      const totalPercentage = totalExpected > 0 ? (totalWorked / totalExpected) * 100 : 0;

      return {
        promoter: {
          id: promoter.id,
          name: promoter.name,
          email: promoter.email,
        },
        summary: {
          totalExpected: Math.round(totalExpected * 100) / 100,
          totalWorked: Math.round(totalWorked * 100) / 100,
          totalDifference: Math.round(totalDifference * 100) / 100,
          totalPercentage: Math.round(totalPercentage * 100) / 100,
          status: totalExpected > 0
            ? totalPercentage >= 100
              ? 'complete'
              : totalPercentage >= 80
              ? 'warning'
              : 'incomplete'
            : 'no_target',
        },
      };
    });

    res.json({
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      promoters: report,
    });
  } catch (error) {
    console.error('Get all promoters hours report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}


