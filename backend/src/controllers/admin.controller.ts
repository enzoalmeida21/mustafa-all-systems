import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { hashPassword } from '../utils/password';
import { UserRole } from '../types';
import { AuthRequest } from '../middleware/auth';

/**
 * Endpoint temporário para executar seed do banco de dados
 * ⚠️ REMOVER EM PRODUÇÃO ou proteger com autenticação forte
 */
export async function seedDatabase(req: Request, res: Response) {
  try {
    // ⚠️ SEGURANÇA: Em produção, adicione uma verificação de secret
    const secret = req.headers['x-seed-secret'] || req.body.secret;
    const expectedSecret = process.env.SEED_SECRET || 'temporary-seed-secret-change-me';
    
    if (secret !== expectedSecret) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    console.log('🌱 Starting database seed...');

    // Create test users
    const adminPassword = await hashPassword('admin123');
    const supervisorPassword = await hashPassword('senha123');
    const promoterPassword = await hashPassword('senha123');

    // Create admin
    const admin = await prisma.user.upsert({
      where: { email: 'admin@promo.com' },
      update: {
        password: adminPassword,
        role: UserRole.ADMIN,
      },
      create: {
        email: 'admin@promo.com',
        name: 'Administrador',
        password: adminPassword,
        role: UserRole.ADMIN,
      },
    });

    console.log('✅ Admin created:', admin.email);

    // Create supervisor
    const supervisor = await prisma.user.upsert({
      where: { email: 'supervisor@teste.com' },
      update: {},
      create: {
        email: 'supervisor@teste.com',
        name: 'Supervisor Teste',
        password: supervisorPassword,
        role: UserRole.SUPERVISOR,
      },
    });

    console.log('✅ Supervisor created:', supervisor.email);

    // Create promoters
    const promoters = await Promise.all([
      prisma.user.upsert({
        where: { email: 'promotor1@teste.com' },
        update: {},
        create: {
          email: 'promotor1@teste.com',
          name: 'Promotor 1',
          password: promoterPassword,
          role: UserRole.PROMOTER,
        },
      }),
      prisma.user.upsert({
        where: { email: 'promotor2@teste.com' },
        update: {},
        create: {
          email: 'promotor2@teste.com',
          name: 'Promotor 2',
          password: promoterPassword,
          role: UserRole.PROMOTER,
        },
      }),
    ]);

    console.log('✅ Promoters created:', promoters.map(p => p.email));

    // Create test stores
    let store1 = await prisma.store.findFirst({
      where: { name: 'Loja ABC' },
    });

    if (!store1) {
      store1 = await prisma.store.create({
        data: {
          name: 'Loja ABC',
          address: 'Rua Teste, 123 - São Paulo, SP',
          latitude: -23.5505,
          longitude: -46.6333,
        },
      });
    }

    let store2 = await prisma.store.findFirst({
      where: { name: 'Loja XYZ' },
    });

    if (!store2) {
      store2 = await prisma.store.create({
        data: {
          name: 'Loja XYZ',
          address: 'Av. Exemplo, 456 - São Paulo, SP',
          latitude: -23.5632,
          longitude: -46.6541,
        },
      });
    }

    console.log('✅ Stores created');

    // Create photo quotas
    await Promise.all(
      promoters.map(promoter =>
        prisma.photoQuota.upsert({
          where: { promoterId: promoter.id },
          update: {},
          create: {
            promoterId: promoter.id,
            expectedPhotos: 10,
          },
        })
      )
    );

    console.log('✅ Photo quotas created');

    res.json({
      success: true,
      message: 'Database seeded successfully',
      users: {
        admin: admin.email,
        supervisor: supervisor.email,
        promoters: promoters.map(p => p.email),
      },
    });
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    res.status(500).json({
      success: false,
      message: 'Error seeding database',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Schemas de validação
const createUserSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.nativeEnum(UserRole),
  state: z.string().length(2).optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  role: z.nativeEnum(UserRole).optional(),
  phone: z.string().optional(),
  state: z.string().length(2).optional().nullable(),
});

/**
 * Listar todos os usuários
 */
export async function listUsers(req: AuthRequest, res: Response) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        state: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({ users });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Criar novo usuário
 */
export async function createUser(req: AuthRequest, res: Response) {
  try {
    const data = createUserSchema.parse(req.body);

    // Verificar se o email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Email já está em uso' });
    }

    // Hash da senha
    const hashedPassword = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashedPassword,
        role: data.role,
        phone: data.phone || null,
        state: data.state?.toUpperCase() || null,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        state: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Atualizar usuário
 */
export async function updateUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);

    // Verificar se o usuário existe
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Se estiver atualizando o email, verificar se não está em uso
    if (data.email && data.email !== existingUser.email) {
      const emailInUse = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailInUse) {
        return res.status(400).json({ message: 'Email já está em uso' });
      }
    }

    const updateData: any = {};
    if (data.email) updateData.email = data.email;
    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.state !== undefined) updateData.state = data.state?.toUpperCase() || null;
    if (data.password) {
      updateData.password = await hashPassword(data.password);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        state: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Deletar usuário
 */
export async function deleteUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Verificar se o usuário existe
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Não permitir deletar a si mesmo
    if (existingUser.id === req.userId) {
      return res.status(400).json({ message: 'Não é possível deletar seu próprio usuário' });
    }

    // Deletar usuário
    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: 'Usuário deletado com sucesso' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Obter detalhes de um usuário
 */
export async function getUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        state: true,
        createdAt: true,
        updatedAt: true,
        supervisorRegions: {
          select: { state: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Atribuir estados a um supervisor
 */
export async function setSupervisorRegions(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { states } = z.object({ states: z.array(z.string().length(2)) }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== UserRole.SUPERVISOR) {
      return res.status(400).json({ message: 'Usuário não é um supervisor' });
    }

    await prisma.$transaction([
      prisma.supervisorRegion.deleteMany({ where: { supervisorId: id } }),
      ...states.map(state =>
        prisma.supervisorRegion.create({
          data: { supervisorId: id, state: state.toUpperCase() },
        })
      ),
    ]);

    const regions = await prisma.supervisorRegion.findMany({
      where: { supervisorId: id },
      select: { state: true },
    });

    res.json({ states: regions.map(r => r.state) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Set supervisor regions error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Listar estados de um supervisor
 */
export async function getSupervisorRegions(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const regions = await prisma.supervisorRegion.findMany({
      where: { supervisorId: id },
      select: { state: true },
    });

    res.json({ states: regions.map(r => r.state) });
  } catch (error) {
    console.error('Get supervisor regions error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Atribuir supervisores a um promotor
 */
export async function setPromoterSupervisors(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { supervisorIds } = z.object({
      supervisorIds: z.array(z.string().uuid()),
    }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== UserRole.PROMOTER) {
      return res.status(400).json({ message: 'Usuário não é um promotor' });
    }

    if (supervisorIds.length > 0) {
      const supervisors = await prisma.user.findMany({
        where: { id: { in: supervisorIds }, role: UserRole.SUPERVISOR },
      });
      if (supervisors.length !== supervisorIds.length) {
        return res.status(400).json({ message: 'Um ou mais supervisores inválidos' });
      }
    }

    await prisma.$transaction([
      prisma.promoterSupervisor.deleteMany({ where: { promoterId: id } }),
      ...supervisorIds.map(supervisorId =>
        prisma.promoterSupervisor.create({
          data: { promoterId: id, supervisorId },
        })
      ),
    ]);

    const result = await prisma.promoterSupervisor.findMany({
      where: { promoterId: id },
      include: { supervisor: { select: { id: true, name: true, email: true } } },
    });

    res.json({ supervisors: result.map(r => r.supervisor) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
    }
    console.error('Set promoter supervisors error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Listar supervisores de um promotor
 */
export async function getPromoterSupervisors(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const result = await prisma.promoterSupervisor.findMany({
      where: { promoterId: id },
      include: { supervisor: { select: { id: true, name: true, email: true } } },
    });

    res.json({ supervisors: result.map(r => r.supervisor) });
  } catch (error) {
    console.error('Get promoter supervisors error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Permite ao promotor iniciar nova visita na mesma loja no mesmo dia (uma vez por concessão).
 * POST /admin/promoters/:id/stores/:storeId/redo-grant
 */
export async function createPromoterStoreRedoGrant(req: AuthRequest, res: Response) {
  try {
    const { id: promoterId, storeId } = req.params;

    if (!z.string().uuid().safeParse(promoterId).success || !z.string().uuid().safeParse(storeId).success) {
      return res.status(400).json({ message: 'IDs inválidos' });
    }

    const promoter = await prisma.user.findUnique({ where: { id: promoterId } });
    if (!promoter || promoter.role !== UserRole.PROMOTER) {
      return res.status(404).json({ message: 'Promotor não encontrado' });
    }

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const grant = await prisma.promoterStoreRedoGrant.create({
      data: {
        promoterId,
        storeId,
        grantedById: req.userId!,
      },
    });

    res.status(201).json({
      message:
        'Concessão criada. O promotor poderá fazer check-in novamente nesta loja hoje (a concessão é usada no próximo check-in após já ter finalizado uma visita no dia).',
      grant: { id: grant.id, promoterId, storeId, createdAt: grant.createdAt },
    });
  } catch (error) {
    console.error('Create redo grant error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Visão geral do ADMIN (somente hoje), preparada para múltiplos estados.
 * GET /admin/promoters/today-overview?state=SP
 */
export async function getAdminTodayPromoterOverview(req: AuthRequest, res: Response) {
  try {
    const { state } = req.query as { state?: string };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const promoters = await prisma.user.findMany({
      where: {
        role: UserRole.PROMOTER,
        ...(state ? { state } : {}),
      },
      select: { id: true, name: true, email: true, state: true },
      orderBy: { name: 'asc' },
    });

    const promoterIds = promoters.map((p) => p.id);

    const visitsToday = await prisma.visit.findMany({
      where: {
        promoterId: { in: promoterIds },
        checkInAt: { gte: todayStart, lt: todayEnd },
      },
      select: { id: true, promoterId: true, checkInAt: true, checkOutAt: true, storeId: true },
      orderBy: { checkInAt: 'asc' },
    });

    const openVisitByPromoter = new Map<string, { id: string; checkInAt: Date; storeId: string }>();
    const lastActivityByPromoter = new Map<string, Date>();
    const visitsCountByPromoter = new Map<string, number>();
    for (const v of visitsToday) {
      visitsCountByPromoter.set(v.promoterId, (visitsCountByPromoter.get(v.promoterId) || 0) + 1);
      const last = v.checkOutAt ?? v.checkInAt;
      const prev = lastActivityByPromoter.get(v.promoterId);
      if (!prev || last.getTime() > prev.getTime()) lastActivityByPromoter.set(v.promoterId, last);
      if (!v.checkOutAt) {
        openVisitByPromoter.set(v.promoterId, { id: v.id, checkInAt: v.checkInAt, storeId: v.storeId });
      }
    }

    // “Falta sem justificativa”: visitas de hoje com checkout completo, mas ainda com indústrias pendentes sem IndustryMiss.
    // (Com o novo bloqueio de checkout, isso tende a ficar 0, mas fica aqui para consistência e auditoria.)
    const completedVisitIds = visitsToday.filter((v) => v.checkOutAt != null).map((v) => v.id);
    const industryMissByVisit = await prisma.industryMiss.findMany({
      where: { visitId: { in: completedVisitIds } },
      select: { visitId: true, industryId: true },
    });
    const missSetByVisit = new Map<string, Set<string>>();
    for (const m of industryMissByVisit) {
      if (!missSetByVisit.has(m.visitId)) missSetByVisit.set(m.visitId, new Set());
      missSetByVisit.get(m.visitId)!.add(m.industryId);
    }

    const storeIndustriesByStore = await prisma.storeIndustry.findMany({
      where: { storeId: { in: visitsToday.map((v) => v.storeId) }, isActive: true },
      select: { storeId: true, industryId: true },
    });
    const reqByStore = new Map<string, string[]>();
    for (const si of storeIndustriesByStore) {
      reqByStore.set(si.storeId, [...(reqByStore.get(si.storeId) || []), si.industryId]);
    }

    const coveredByVisit = await prisma.photoIndustry.findMany({
      where: { visitId: { in: completedVisitIds } },
      select: { visitId: true, industryId: true },
    });
    const coveredSetByVisit = new Map<string, Set<string>>();
    for (const c of coveredByVisit) {
      if (!coveredSetByVisit.has(c.visitId)) coveredSetByVisit.set(c.visitId, new Set());
      coveredSetByVisit.get(c.visitId)!.add(c.industryId);
    }

    const unjustifiedByPromoter = new Map<string, number>();
    for (const v of visitsToday) {
      if (!v.checkOutAt) continue;
      const required = reqByStore.get(v.storeId) || [];
      if (required.length === 0) continue;
      const covered = coveredSetByVisit.get(v.id) || new Set<string>();
      const misses = missSetByVisit.get(v.id) || new Set<string>();
      const pending = required.filter((industryId) => !covered.has(industryId));
      const pendingWithoutJustification = pending.filter((industryId) => !misses.has(industryId));
      if (pendingWithoutJustification.length > 0) {
        unjustifiedByPromoter.set(
          v.promoterId,
          (unjustifiedByPromoter.get(v.promoterId) || 0) + pendingWithoutJustification.length
        );
      }
    }

    // Agregar por estado
    const byState = new Map<string, any>();
    for (const p of promoters) {
      const uf = p.state || '—';
      if (!byState.has(uf)) {
        byState.set(uf, {
          state: uf,
          promotersTotal: 0,
          openVisits: 0,
          noVisitToday: 0,
          unjustifiedMisses: 0,
        });
      }
      const row = byState.get(uf);
      row.promotersTotal += 1;

      const visitsCount = visitsCountByPromoter.get(p.id) || 0;
      const hasOpen = openVisitByPromoter.has(p.id);
      if (hasOpen) row.openVisits += 1;
      if (visitsCount === 0) row.noVisitToday += 1;
      row.unjustifiedMisses += unjustifiedByPromoter.get(p.id) || 0;
    }

    res.json({
      date: todayStart.toISOString().slice(0, 10),
      states: Array.from(byState.values()).sort((a, b) => a.state.localeCompare(b.state)),
      promoters: promoters.map((p) => {
        const visitsCount = visitsCountByPromoter.get(p.id) || 0;
        return {
          id: p.id,
          name: p.name,
          email: p.email,
          state: p.state,
          visitsToday: visitsCount,
          hasOpenVisit: openVisitByPromoter.has(p.id),
          noVisitToday: visitsCount === 0,
          unjustifiedMissesToday: unjustifiedByPromoter.get(p.id) || 0,
          lastActivityAt: lastActivityByPromoter.get(p.id)?.toISOString() ?? null,
          openVisit: openVisitByPromoter.get(p.id) || null,
        };
      }),
    });
  } catch (error) {
    console.error('Get admin today overview error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
