import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma/client';

const createStoreSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).optional(),
  address: z.string().min(1),
  state: z.string().length(2).optional(),
  latitude: z.number().optional().default(0),
  longitude: z.number().optional().default(0),
  industryIds: z.array(z.string().uuid()).optional(),
});

const updateStoreSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional().nullable(),
  address: z.string().min(1).optional(),
  state: z.string().length(2).optional().nullable(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const bulkCreateSchema = z.object({
  stores: z.array(z.object({
    name: z.string().min(1),
    code: z.string().min(1).optional(),
    address: z.string().min(1),
    state: z.string().length(2).optional(),
    latitude: z.number().optional().default(0),
    longitude: z.number().optional().default(0),
    industryIds: z.array(z.string().uuid()).optional(),
  })).min(1),
});

export async function createStore(req: AuthRequest, res: Response) {
  try {
    const data = createStoreSchema.parse(req.body);
    const { industryIds, ...storeData } = data;

    if (storeData.code) {
      const existing = await prisma.store.findUnique({ where: { code: storeData.code } });
      if (existing) {
        return res.status(400).json({ message: `Código "${storeData.code}" já está em uso` });
      }
    }

    const store = await prisma.store.create({
      data: {
        ...storeData,
        code: storeData.code || null,
        state: storeData.state?.toUpperCase() || null,
      },
    });

    if (industryIds && industryIds.length > 0) {
      await Promise.all(
        industryIds.map(industryId =>
          prisma.storeIndustry.upsert({
            where: { storeId_industryId: { storeId: store.id, industryId } },
            create: { storeId: store.id, industryId, isActive: true },
            update: { isActive: true },
          })
        )
      );
    }

    const storeWithIndustries = await prisma.store.findUnique({
      where: { id: store.id },
      include: { storeIndustries: { where: { isActive: true }, include: { industry: true } } },
    });

    res.status(201).json({ store: storeWithIndustries });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Create store error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function bulkCreateStores(req: AuthRequest, res: Response) {
  try {
    const { stores } = bulkCreateSchema.parse(req.body);

    const results: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < stores.length; i++) {
      const { industryIds, ...storeData } = stores[i];
      try {
        if (storeData.code) {
          const existing = await prisma.store.findUnique({ where: { code: storeData.code } });
          if (existing) {
            errors.push({ index: i, name: storeData.name, message: `Código "${storeData.code}" já existe` });
            continue;
          }
        }

        const store = await prisma.store.create({
          data: {
            ...storeData,
            code: storeData.code || null,
            state: storeData.state?.toUpperCase() || null,
          },
        });

        if (industryIds && industryIds.length > 0) {
          await Promise.all(
            industryIds.map(industryId =>
              prisma.storeIndustry.upsert({
                where: { storeId_industryId: { storeId: store.id, industryId } },
                create: { storeId: store.id, industryId, isActive: true },
                update: { isActive: true },
              })
            )
          );
        }

        results.push(store);
      } catch (err: any) {
        errors.push({ index: i, name: storeData.name, message: err.message || 'Erro ao criar' });
      }
    }

    res.status(201).json({ created: results.length, errors, stores: results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Bulk create stores error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function updateStore(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const data = updateStoreSchema.parse(req.body);

    const store = await prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const updatedStore = await prisma.store.update({
      where: { id },
      data,
    });

    res.json({ store: updatedStore });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Update store error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function deleteStore(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const store = await prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    await prisma.store.delete({
      where: { id },
    });

    res.json({ message: 'Loja deletada com sucesso' });
  } catch (error) {
    console.error('Delete store error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getAllStores(req: AuthRequest, res: Response) {
  try {
    const stores = await prisma.store.findMany({
      include: {
        storeIndustries: {
          where: { isActive: true },
          include: { industry: { select: { id: true, name: true, code: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ stores });
  } catch (error) {
    console.error('Get all stores error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getStore(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const store = await prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    res.json({ store });
  } catch (error) {
    console.error('Get store error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

