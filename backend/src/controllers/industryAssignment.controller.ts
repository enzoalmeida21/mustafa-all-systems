import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { AuthRequest } from '../middleware/auth';

const assignPromoterSchema = z.object({
  promoterId: z.string().uuid(),
  industryId: z.string().uuid(),
  storeId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
});

/**
 * Atribuir promotor a indústria
 */
export async function assignPromoterToIndustry(req: AuthRequest, res: Response) {
  try {
    const data = assignPromoterSchema.parse(req.body);

    // Verificar se o promotor existe e é PROMOTER
    const promoter = await prisma.user.findUnique({
      where: { id: data.promoterId },
    });

    if (!promoter || promoter.role !== 'PROMOTER') {
      return res.status(404).json({ message: 'Promotor não encontrado' });
    }

    // Verificar se a indústria existe
    const industry = await prisma.industry.findUnique({
      where: { id: data.industryId },
    });

    if (!industry) {
      return res.status(404).json({ message: 'Indústria não encontrada' });
    }

    // Se storeId foi fornecido, verificar se a loja existe
    if (data.storeId) {
      const store = await prisma.store.findUnique({
        where: { id: data.storeId },
      });

      if (!store) {
        return res.status(404).json({ message: 'Loja não encontrada' });
      }
    }

    // Verificar se já existe atribuição
    const whereClause: any = {
      promoterId: data.promoterId,
      industryId: data.industryId,
    };
    if (data.storeId) {
      whereClause.storeId = data.storeId;
    } else {
      whereClause.storeId = null;
    }
    
    const existing = await prisma.industryAssignment.findFirst({
      where: whereClause,
    });

    let assignment;
    if (existing) {
      // Atualizar existente
      assignment = await prisma.industryAssignment.update({
        where: { id: existing.id },
        data: { isActive: data.isActive },
        include: {
          promoter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          industry: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          store: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
      });
    } else {
      // Criar novo
      assignment = await prisma.industryAssignment.create({
        data,
        include: {
          promoter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          industry: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          store: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
      });
    }

    res.status(201).json({ assignment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Assign promoter to industry error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Indústrias de um promotor
 */
export async function getPromoterIndustries(req: AuthRequest, res: Response) {
  try {
    const { promoterId } = req.params;

    const assignments = await prisma.industryAssignment.findMany({
      where: {
        promoterId,
        isActive: true,
      },
      include: {
        industry: true,
        store: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
      orderBy: {
        industry: {
          name: 'asc',
        },
      },
    });

    res.json({ assignments });
  } catch (error) {
    console.error('Get promoter industries error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Promotores de uma indústria
 */
export async function getIndustryPromoters(req: AuthRequest, res: Response) {
  try {
    const { industryId } = req.params;
    const { storeId } = req.query;

    const where: any = {
      industryId,
      isActive: true,
    };

    if (storeId) {
      where.storeId = storeId as string;
    }

    const assignments = await prisma.industryAssignment.findMany({
      where,
      include: {
        promoter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
      orderBy: {
        promoter: {
          name: 'asc',
        },
      },
    });

    res.json({ assignments });
  } catch (error) {
    console.error('Get industry promoters error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

const setMyStoreIndustriesSchema = z.object({
  industryIds: z.array(z.string().uuid()).min(1, 'Selecione pelo menos uma indústria'),
});

/**
 * Promotor define as indústrias que atende em uma loja (onboarding ou alteração).
 * POST /industry-assignments/me/store/:storeId
 */
export async function setMyStoreIndustries(req: AuthRequest, res: Response) {
  try {
    const promoterId = req.userId!;
    const { storeId } = req.params;
    const { industryIds } = setMyStoreIndustriesSchema.parse(req.body);

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: {
        storeIndustries: {
          where: { isActive: true },
          select: { industryId: true },
        },
      },
    });
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const validIds = new Set(store.storeIndustries.map(si => si.industryId));
    const invalid = industryIds.filter(id => !validIds.has(id));
    if (invalid.length > 0) {
      return res.status(400).json({ message: 'Uma ou mais indústrias não pertencem a esta loja' });
    }

    await prisma.$transaction([
      prisma.industryAssignment.deleteMany({
        where: { promoterId, storeId },
      }),
      ...industryIds.map(industryId =>
        prisma.industryAssignment.create({
          data: { promoterId, industryId, storeId, isActive: true },
        })
      ),
    ]);

    const assignments = await prisma.industryAssignment.findMany({
      where: { promoterId, storeId, isActive: true },
      include: { industry: true },
    });

    res.json({
      message: 'Indústrias atualizadas',
      industries: assignments.map(a => a.industry),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0]?.message ?? 'Dados inválidos' });
    }
    console.error('Set my store industries error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

const setPromoterStoreIndustriesSchema = z.object({
  industryIds: z.array(z.string().uuid()),
});

/**
 * Admin: definir indústrias que um promotor atende em uma loja (substitui as atuais).
 * PUT /industry-assignments/promoter/:promoterId/store/:storeId
 */
export async function setPromoterStoreIndustries(req: AuthRequest, res: Response) {
  try {
    const { promoterId, storeId } = req.params;
    const { industryIds } = setPromoterStoreIndustriesSchema.parse(req.body);

    const promoter = await prisma.user.findUnique({
      where: { id: promoterId },
    });
    if (!promoter || promoter.role !== 'PROMOTER') {
      return res.status(404).json({ message: 'Promotor não encontrado' });
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: {
        storeIndustries: {
          where: { isActive: true },
          select: { industryId: true },
        },
      },
    });
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const validIds = new Set(store.storeIndustries.map(si => si.industryId));
    if (industryIds.length > 0) {
      const invalid = industryIds.filter(id => !validIds.has(id));
      if (invalid.length > 0) {
        return res.status(400).json({ message: 'Uma ou mais indústrias não pertencem a esta loja' });
      }
    }

    await prisma.$transaction([
      prisma.industryAssignment.deleteMany({
        where: { promoterId, storeId },
      }),
      ...industryIds.map(industryId =>
        prisma.industryAssignment.create({
          data: { promoterId, industryId, storeId, isActive: true },
        })
      ),
    ]);

    const assignments = await prisma.industryAssignment.findMany({
      where: { promoterId, storeId, isActive: true },
      include: { industry: true },
    });

    res.json({
      message: 'Indústrias do promotor nesta loja atualizadas',
      industries: assignments.map(a => a.industry),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0]?.message ?? 'Dados inválidos' });
    }
    console.error('Set promoter store industries error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Remover atribuição
 */
export async function removeAssignment(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const assignment = await prisma.industryAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Atribuição não encontrada' });
    }

    await prisma.industryAssignment.delete({
      where: { id },
    });

    res.json({ message: 'Atribuição removida com sucesso' });
  } catch (error) {
    console.error('Remove assignment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

