import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma/client';
import { UserRole } from '../types';

export async function getDashboard(req: AuthRequest, res: Response) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Total de promotores
    const totalPromoters = await prisma.user.count({
      where: { role: UserRole.PROMOTER },
    });

    // Visitas hoje
    const visitsToday = await prisma.visit.count({
      where: {
        checkInAt: {
          gte: today,
        },
      },
    });

    // Visitas esta semana
    const visitsThisWeek = await prisma.visit.count({
      where: {
        checkInAt: {
          gte: startOfWeek,
        },
      },
    });

    // Visitas este mês
    const visitsThisMonth = await prisma.visit.count({
      where: {
        checkInAt: {
          gte: startOfMonth,
        },
      },
    });

    // Promotores ativos hoje
    const activePromotersToday = await prisma.visit.groupBy({
      by: ['promoterId'],
      where: {
        checkInAt: {
          gte: today,
        },
      },
    });

    // Visitas por promotor (últimos 7 dias)
    const visitsByPromoter = await prisma.visit.groupBy({
      by: ['promoterId'],
      where: {
        checkInAt: {
          gte: startOfWeek,
        },
      },
      _count: {
        id: true,
      },
    });

    // Horas trabalhadas hoje
    const visitsWithHours = await prisma.visit.findMany({
      where: {
        checkInAt: {
          gte: today,
        },
        checkOutAt: {
          not: null,
        },
      },
      select: {
        checkInAt: true,
        checkOutAt: true,
      },
    });

    const totalHoursToday = visitsWithHours.reduce((total: number, visit: any) => {
      if (visit.checkOutAt) {
        const hours = (visit.checkOutAt.getTime() - visit.checkInAt.getTime()) / (1000 * 60 * 60);
        return total + hours;
      }
      return total;
    }, 0);

    res.json({
      stats: {
        totalPromoters,
        visitsToday,
        visitsThisWeek,
        visitsThisMonth,
        activePromotersToday: activePromotersToday.length,
        totalHoursToday: totalHoursToday.toFixed(2),
      },
      visitsByPromoter: visitsByPromoter.map((v: any) => ({
        promoterId: v.promoterId,
        visitCount: v._count.id,
      })),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getPromoterPerformance(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // Configurar data inicial (início do dia)
    const start = startDate ? new Date(startDate as string) : new Date();
    if (startDate) {
      start.setHours(0, 0, 0, 0); // Início do dia
    } else {
      start.setDate(start.getDate() - 30); // Últimos 30 dias por padrão
    }
    
    // Configurar data final (fim do dia)
    const end = endDate ? new Date(endDate as string) : new Date();
    if (endDate) {
      end.setHours(23, 59, 59, 999); // Fim do dia para incluir todo o dia selecionado
    }

    // Verificar se o promotor existe
    const promoter = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true },
    });

    if (!promoter || promoter.id !== id) {
      return res.status(404).json({ message: 'Promotor não encontrado' });
    }

    // Visitas no período
    const visits = await prisma.visit.findMany({
      where: {
        promoterId: id,
        checkInAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        store: true,
        photos: true,
      },
      orderBy: {
        checkInAt: 'desc',
      },
    });

    // Calcular estatísticas
    const totalVisits = visits.length;
    const completedVisits = visits.filter((v: any) => v.checkOutAt !== null).length;
    const totalHours = visits
      .filter((v: any) => v.checkOutAt !== null)
      .reduce((total: number, visit: any) => {
        if (visit.checkOutAt) {
          const hours = (visit.checkOutAt.getTime() - visit.checkInAt.getTime()) / (1000 * 60 * 60);
          return total + hours;
        }
        return total;
      }, 0);

    const totalPhotos = visits.reduce((total: number, visit: any) => total + visit.photos.length, 0);

    // Visitas por dia (últimos 30 dias)
    const visitsByDay = await prisma.visit.groupBy({
      by: ['checkInAt'],
      where: {
        promoterId: id,
        checkInAt: {
          gte: start,
          lte: end,
        },
      },
      _count: {
        id: true,
      },
    });

    res.json({
      promoter,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      stats: {
        totalVisits,
        completedVisits,
        totalHours: totalHours.toFixed(2),
        totalPhotos,
        averageHoursPerVisit: completedVisits > 0 ? (totalHours / completedVisits).toFixed(2) : '0',
      },
      visits: visits.map((visit: any) => ({
        id: visit.id,
        store: visit.store,
        checkInAt: visit.checkInAt,
        checkOutAt: visit.checkOutAt,
        hoursWorked: visit.checkOutAt
          ? ((visit.checkOutAt.getTime() - visit.checkInAt.getTime()) / (1000 * 60 * 60)).toFixed(2)
          : null,
        photoCount: visit.photos.length,
        checkInPhotoUrl: visit.checkInPhotoUrl,
        checkOutPhotoUrl: visit.checkOutPhotoUrl,
      })),
      visitsByDay: visitsByDay.map((v: any) => ({
        date: v.checkInAt.toISOString().split('T')[0],
        count: v._count.id,
      })),
    });
  } catch (error) {
    console.error('Promoter performance error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getPromoterVisits(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Verificar se o promotor existe
    const promoter = await prisma.user.findUnique({
      where: { id },
    });

    if (!promoter) {
      return res.status(404).json({ message: 'Promotor não encontrado' });
    }

    // Buscar visitas com promotor e fotos (com indústria para etiquetas)
    const [visits, total] = await Promise.all([
      prisma.visit.findMany({
        where: { promoterId: id },
        include: {
          promoter: { select: { name: true } },
          store: true,
          photos: {
            orderBy: { createdAt: 'asc' },
            include: {
              photoIndustries: {
                take: 1,
                include: { industry: { select: { name: true, abbreviation: true } } },
              },
            },
          },
        },
        orderBy: { checkInAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.visit.count({ where: { promoterId: id } }),
    ]);

    res.json({
      visits: visits.map((visit: any) => ({
        id: visit.id,
        store: visit.store,
        promoterName: visit.promoter?.name ?? null,
        checkInAt: visit.checkInAt,
        checkOutAt: visit.checkOutAt,
        checkInLatitude: visit.checkInLatitude,
        checkInLongitude: visit.checkInLongitude,
        checkOutLatitude: visit.checkOutLatitude,
        checkOutLongitude: visit.checkOutLongitude,
        checkInPhotoUrl: visit.checkInPhotoUrl,
        checkOutPhotoUrl: visit.checkOutPhotoUrl,
        hoursWorked: visit.checkOutAt
          ? ((visit.checkOutAt.getTime() - visit.checkInAt.getTime()) / (1000 * 60 * 60)).toFixed(2)
          : null,
        photos: visit.photos.map((p: any) => {
          const industry = p.photoIndustries?.[0]?.industry;
          return {
            id: p.id,
            url: p.url,
            type: p.type,
            latitude: p.latitude,
            longitude: p.longitude,
            createdAt: p.createdAt,
            industryName: industry?.name ?? null,
            industryAbbreviation: industry?.abbreviation ?? null,
          };
        }),
        photoCount: visit.photos.length,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get promoter visits error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getPromoterRoute(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { date } = req.query;

    const targetDate = date ? new Date(date as string) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Verificar se o promotor existe
    const promoter = await prisma.user.findUnique({
      where: { id },
    });

    if (!promoter) {
      return res.status(404).json({ message: 'Promotor não encontrado' });
    }

    // Buscar visitas do dia
    const visits = await prisma.visit.findMany({
      where: {
        promoterId: id,
        checkInAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        store: true,
        locations: {
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
      orderBy: {
        checkInAt: 'asc',
      },
    });

    // Construir rota
    const route = visits.map((visit: any) => ({
      id: visit.id,
      store: visit.store,
      checkInAt: visit.checkInAt,
      checkOutAt: visit.checkOutAt,
      checkInLocation: {
        latitude: visit.checkInLatitude,
        longitude: visit.checkInLongitude,
      },
      checkOutLocation: visit.checkOutAt
        ? {
            latitude: visit.checkOutLatitude!,
            longitude: visit.checkOutLongitude!,
          }
        : null,
      locations: visit.locations.map((loc: any) => ({
        latitude: loc.latitude,
        longitude: loc.longitude,
        timestamp: loc.timestamp,
      })),
    }));

    res.json({
      date: targetDate.toISOString().split('T')[0],
      promoter: {
        id: promoter.id,
        name: promoter.name,
      },
      route,
      totalVisits: visits.length,
    });
  } catch (error) {
    console.error('Get promoter route error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getMissingPhotos(req: AuthRequest, res: Response) {
  try {
    const { promoterId, startDate, endDate } = req.query;

    // Configurar data inicial (início do dia)
    const start = startDate ? new Date(startDate as string) : new Date();
    if (startDate) {
      start.setHours(0, 0, 0, 0); // Início do dia
    } else {
      start.setDate(start.getDate() - 30);
    }
    
    // Configurar data final (fim do dia)
    const end = endDate ? new Date(endDate as string) : new Date();
    if (endDate) {
      end.setHours(23, 59, 59, 999); // Fim do dia para incluir todo o dia selecionado
    }

    // Buscar visitas sem fotos adicionais (apenas check-in/checkout)
    const visits = await prisma.visit.findMany({
      where: {
        ...(promoterId ? { promoterId: promoterId as string } : {}),
        checkInAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        store: true,
        photos: true,
        promoter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Filtrar visitas com poucas fotos (apenas check-in/checkout)
    const visitsWithMissingPhotos = visits.filter((visit: any) => {
      const photoCount = visit.photos.length;
      // Considerar que faltam fotos se tiver apenas 1 ou 2 fotos (check-in e checkout)
      return photoCount <= 2;
    });

    res.json({
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      missingPhotos: visitsWithMissingPhotos.map((visit: any) => ({
        visitId: visit.id,
        promoter: visit.promoter,
        store: visit.store,
        checkInAt: visit.checkInAt,
        checkOutAt: visit.checkOutAt,
        photoCount: visit.photos.length,
        expectedPhotos: 3, // Mínimo esperado
      })),
      total: visitsWithMissingPhotos.length,
    });
  } catch (error) {
    console.error('Get missing photos error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

const setPhotoQuotaSchema = z.object({
  expectedPhotos: z.number().int().positive(),
});

export async function setPhotoQuota(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { expectedPhotos } = setPhotoQuotaSchema.parse(req.body);

    // Verificar se o promotor existe
    const promoter = await prisma.user.findUnique({
      where: { id },
    });

    if (!promoter) {
      return res.status(404).json({ message: 'Promotor não encontrado' });
    }

    // Criar ou atualizar quota
    const quota = await prisma.photoQuota.upsert({
      where: { promoterId: id },
      update: {
        expectedPhotos,
      },
      create: {
        promoterId: id,
        expectedPhotos,
      },
    });

    res.json({
      quota,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    console.error('Set photo quota error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

const exportReportSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  promoterIds: z.array(z.string().uuid()).optional(),
  storeIds: z.array(z.string().uuid()).optional(),
  format: z.enum(['pptx', 'pdf', 'excel', 'html']),
});

export async function exportReport(req: AuthRequest, res: Response) {
  try {
    const { startDate, endDate, promoterIds, storeIds, format } = exportReportSchema.parse(
      req.body
    );
    const userId = req.userId!;

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0); // Início do dia
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Fim do dia

    // Criar job de exportação
    const exportJob = await prisma.exportJob.create({
      data: {
        userId,
        status: 'processing',
        progress: 0,
        format,
        filters: {
          startDate,
          endDate,
          promoterIds: promoterIds || [],
          storeIds: storeIds || [],
        },
      },
    });

    // Gerar relatório em background (simulado - em produção usar queue)
    setImmediate(async () => {
      try {
        const {
          generatePowerPointReport,
          generatePDFReport,
          generateExcelReport,
          generateHTMLReport,
        } = await import('../services/export.service');

        let buffer: Buffer | string;
        let contentType: string;
        let filename: string;

        switch (format) {
          case 'pptx':
            buffer = await generatePowerPointReport({
              startDate: start,
              endDate: end,
              promoterIds,
              storeIds,
              format,
            });
            contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
            filename = `relatorio-${startDate}-${endDate}.pptx`;
            break;
          case 'pdf':
            buffer = await generatePDFReport({
              startDate: start,
              endDate: end,
              promoterIds,
              storeIds,
              format,
            });
            contentType = 'application/pdf';
            filename = `relatorio-${startDate}-${endDate}.pdf`;
            break;
          case 'excel':
            buffer = await generateExcelReport({
              startDate: start,
              endDate: end,
              promoterIds,
              storeIds,
              format,
            });
            contentType =
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            filename = `relatorio-${startDate}-${endDate}.xlsx`;
            break;
          case 'html':
            buffer = await generateHTMLReport({
              startDate: start,
              endDate: end,
              promoterIds,
              storeIds,
              format,
            });
            contentType = 'text/html';
            filename = `relatorio-${startDate}-${endDate}.html`;
            break;
          default:
            throw new Error('Formato não suportado');
        }

        // Salvar arquivo (em produção, salvar no S3 ou sistema de arquivos)
        // Por enquanto, vamos retornar o buffer diretamente
        const downloadUrl = `/api/supervisors/export/download/${exportJob.id}`;

        await prisma.exportJob.update({
          where: { id: exportJob.id },
          data: {
            status: 'completed',
            progress: 100,
            downloadUrl,
          },
        });
      } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        await prisma.exportJob.update({
          where: { id: exportJob.id },
          data: {
            status: 'failed',
          },
        });
      }
    });

    res.json({
      jobId: exportJob.id,
      status: exportJob.status,
      message: 'Relatório sendo gerado. Use o jobId para verificar o status.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    console.error('Export report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Dashboard de pendências de indústrias
 * GET /supervisors/pending-industries
 * Query params: ?view=store | ?view=promoter | ?date=2024-12-16
 */
export async function getPendingIndustries(req: AuthRequest, res: Response) {
  try {
    const { view = 'store', date } = req.query;

    // Configurar período (hoje por padrão)
    const targetDate = date ? new Date(date as string) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    if (view === 'store') {
      // Visão por Loja: quais lojas têm indústrias não cobertas
      const stores = await prisma.store.findMany({
        include: {
          storeIndustries: {
            where: { isActive: true },
            include: { industry: true },
          },
          visits: {
            where: {
              checkInAt: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
            include: {
              photoIndustries: true,
              promoter: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      const pendingByStore = stores
        .filter(s => s.storeIndustries.length > 0)
        .map(store => {
          // Coletar todas as indústrias cobertas em todas as visitas do dia
          const allPhotoIndustries = store.visits.flatMap(v => v.photoIndustries);
          const coveredIds = new Set(allPhotoIndustries.map(pi => pi.industryId));
          
          const pendingIndustries = store.storeIndustries
            .filter(si => !coveredIds.has(si.industryId))
            .map(si => si.industry);

          const coveredIndustries = store.storeIndustries
            .filter(si => coveredIds.has(si.industryId))
            .map(si => si.industry);

          // Última visita do dia
          const lastVisit = store.visits.length > 0
            ? store.visits.sort((a, b) => 
                new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime()
              )[0]
            : null;

          return {
            store: { id: store.id, name: store.name, address: store.address },
            totalRequired: store.storeIndustries.length,
            totalCovered: coveredIndustries.length,
            pendingIndustries,
            coveredIndustries,
            lastVisit: lastVisit ? {
              id: lastVisit.id,
              checkInAt: lastVisit.checkInAt,
              promoter: lastVisit.promoter,
            } : null,
            visitsCount: store.visits.length,
          };
        })
        .filter(s => s.pendingIndustries.length > 0)
        .sort((a, b) => b.pendingIndustries.length - a.pendingIndustries.length);

      // Estatísticas gerais
      const totalStoresWithRequirements = stores.filter(s => s.storeIndustries.length > 0).length;
      const totalStoresWithPending = pendingByStore.length;
      const totalStoresComplete = totalStoresWithRequirements - totalStoresWithPending;

      res.json({
        view: 'store',
        date: targetDate.toISOString().split('T')[0],
        stats: {
          totalStoresWithRequirements,
          totalStoresWithPending,
          totalStoresComplete,
          complianceRate: totalStoresWithRequirements > 0
            ? Math.round((totalStoresComplete / totalStoresWithRequirements) * 100)
            : 100,
        },
        pending: pendingByStore,
      });

    } else {
      // Visão por Promotor: quais promotores não cobriram indústrias
      const visits = await prisma.visit.findMany({
        where: {
          checkInAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: {
          promoter: { select: { id: true, name: true, email: true } },
          store: {
            include: {
              storeIndustries: {
                where: { isActive: true },
                include: { industry: true },
              },
            },
          },
          photoIndustries: true,
        },
      });

      const pendingByPromoter = visits
        .filter(v => v.store.storeIndustries.length > 0)
        .map(visit => {
          const coveredIds = new Set(visit.photoIndustries.map(pi => pi.industryId));
          
          const pendingIndustries = visit.store.storeIndustries
            .filter(si => !coveredIds.has(si.industryId))
            .map(si => ({
              ...si.industry,
              storeName: visit.store.name,
            }));

          const coveredIndustries = visit.store.storeIndustries
            .filter(si => coveredIds.has(si.industryId))
            .map(si => si.industry);

          return {
            promoter: visit.promoter,
            store: { id: visit.store.id, name: visit.store.name },
            visitId: visit.id,
            visitDate: visit.checkInAt,
            checkOutAt: visit.checkOutAt,
            totalRequired: visit.store.storeIndustries.length,
            totalCovered: coveredIndustries.length,
            pendingIndustries,
            coveredIndustries,
            percentComplete: visit.store.storeIndustries.length > 0
              ? Math.round((coveredIndustries.length / visit.store.storeIndustries.length) * 100)
              : 100,
          };
        })
        .filter(v => v.pendingIndustries.length > 0)
        .sort((a, b) => b.pendingIndustries.length - a.pendingIndustries.length);

      // Estatísticas gerais
      const visitsWithRequirements = visits.filter(v => v.store.storeIndustries.length > 0);
      const visitsComplete = visitsWithRequirements.filter(v => {
        const coveredIds = new Set(v.photoIndustries.map(pi => pi.industryId));
        return v.store.storeIndustries.every(si => coveredIds.has(si.industryId));
      });

      res.json({
        view: 'promoter',
        date: targetDate.toISOString().split('T')[0],
        stats: {
          totalVisitsWithRequirements: visitsWithRequirements.length,
          totalVisitsWithPending: pendingByPromoter.length,
          totalVisitsComplete: visitsComplete.length,
          complianceRate: visitsWithRequirements.length > 0
            ? Math.round((visitsComplete.length / visitsWithRequirements.length) * 100)
            : 100,
        },
        pending: pendingByPromoter,
      });
    }
  } catch (error) {
    console.error('Get pending industries error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Retorna os estados dos promotores vinculados ao supervisor
 */
export async function getMyStates(req: AuthRequest, res: Response) {
  try {
    const supervisorId = req.userId!;

    const stateSet = new Set<string>();

    // 1. Estados dos promotores vinculados via PromoterSupervisor
    const promoters = await prisma.user.findMany({
      where: {
        role: UserRole.PROMOTER,
        promoterSupervisors: { some: { supervisorId } },
        state: { not: null },
      },
      select: { state: true },
      distinct: ['state'],
    });
    promoters.forEach(p => { if (p.state) stateSet.add(p.state); });

    // 2. Estados das lojas atribuídas com supervisorId direto
    const routeStores = await prisma.routeAssignment.findMany({
      where: { supervisorId, isActive: true },
      select: { store: { select: { state: true } } },
    });
    routeStores.forEach(ra => { if (ra.store.state) stateSet.add(ra.store.state); });

    // 3. Fallback: SupervisorRegion
    if (stateSet.size === 0) {
      const regions = await prisma.supervisorRegion.findMany({
        where: { supervisorId },
        select: { state: true },
        orderBy: { state: 'asc' },
      });
      return res.json({ states: regions.map(r => r.state) });
    }

    res.json({ states: Array.from(stateSet).sort() });
  } catch (error) {
    console.error('Get my states error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Retorna promotores com status de pendencia para um estado
 */
export async function getPendingOverview(req: AuthRequest, res: Response) {
  try {
    const supervisorId = req.userId!;
    const { state } = req.query;

    // Promotor aparece se tem PromoterSupervisor OU routeAssignment com supervisorId
    const whereClause: any = {
      role: UserRole.PROMOTER,
      OR: [
        { promoterSupervisors: { some: { supervisorId } } },
        { routeAssignments: { some: { supervisorId, isActive: true } } },
      ],
    };

    if (state) {
      whereClause.state = String(state).toUpperCase();
    }

    const promoters = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        state: true,
        routeAssignments: {
          where: { isActive: true },
          select: {
            supervisorId: true,
            store: {
              select: {
                id: true,
                name: true,
                state: true,
                storeIndustries: {
                  where: { isActive: true },
                  select: {
                    industry: {
                      select: { id: true, name: true, code: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Para cada promotor, verificar fotos enviadas por industria na visita mais recente de cada loja
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await Promise.all(
      promoters.map(async (promoter) => {
        // Filtrar route assignments: mostrar se supervisorId == eu OU se supervisorId == null
        const relevantAssignments = promoter.routeAssignments.filter(
          ra => ra.supervisorId === supervisorId || ra.supervisorId === null
        );

        const storeIds = relevantAssignments.map(ra => ra.store.id);

        // Reduz N+1: busca assignments e últimas visitas em lote por promotor.
        const [assignments, latestVisits] = await Promise.all([
          prisma.industryAssignment.findMany({
            where: {
              promoterId: promoter.id,
              isActive: true,
              storeId: { in: storeIds },
            },
            include: { industry: true },
          }),
          prisma.visit.findMany({
            where: {
              promoterId: promoter.id,
              storeId: { in: storeIds },
            },
            orderBy: [{ storeId: 'asc' }, { checkInAt: 'desc' }],
            distinct: ['storeId'],
            select: {
              storeId: true,
              checkInAt: true,
              checkOutAt: true,
              photos: {
                where: { type: 'OTHER' },
                select: { selectedIndustryId: true },
              },
            },
          }),
        ]);

        const assignmentsByStore = new Map<string, typeof assignments>();
        assignments.forEach((assignment) => {
          const storeAssignments = assignmentsByStore.get(assignment.storeId || '') || [];
          storeAssignments.push(assignment);
          assignmentsByStore.set(assignment.storeId || '', storeAssignments);
        });

        const latestVisitByStore = new Map(latestVisits.map(v => [v.storeId, v]));

        const stores = relevantAssignments.map((ra) => {
          const store = ra.store;
          const promoterStoreAssignments = assignmentsByStore.get(store.id) || [];
          const requiredIndustries =
            promoterStoreAssignments.length > 0
              ? promoterStoreAssignments.map(a => a.industry)
              : store.storeIndustries.map(si => si.industry);

          if (requiredIndustries.length === 0) {
            return {
              id: store.id,
              name: store.name,
              industries: [],
              totalRequired: 0,
              totalCovered: 0,
            };
          }

          const latestVisit = latestVisitByStore.get(store.id);
          const coveredIndustryIds = new Set(
            (latestVisit?.photos || [])
              .map(p => p.selectedIndustryId)
              .filter(Boolean)
          );

          const industries = requiredIndustries.map(ind => ({
            id: ind.id,
            name: ind.name,
            code: ind.code,
            hasCoverage: coveredIndustryIds.has(ind.id),
            photoCount: (latestVisit?.photos || []).filter(
              p => p.selectedIndustryId === ind.id
            ).length,
          }));

          return {
            id: store.id,
            name: store.name,
            lastVisitAt: latestVisit?.checkInAt || null,
            lastVisitCompleted: !!latestVisit?.checkOutAt,
            industries,
            totalRequired: requiredIndustries.length,
            totalCovered: industries.filter(i => i.hasCoverage).length,
          };
        });

        const totalRequired = stores.reduce((sum, s) => sum + s.totalRequired, 0);
        const totalCovered = stores.reduce((sum, s) => sum + s.totalCovered, 0);
        const isPending = totalRequired > 0 && totalCovered < totalRequired;

        return {
          id: promoter.id,
          name: promoter.name,
          email: promoter.email,
          state: promoter.state,
          stores,
          totalRequired,
          totalCovered,
          isPending,
        };
      })
    );

    // Ordenar: pendentes primeiro
    result.sort((a, b) => {
      if (a.isPending && !b.isPending) return -1;
      if (!a.isPending && b.isPending) return 1;
      return a.name.localeCompare(b.name);
    });

    const summary = {
      total: result.length,
      pending: result.filter(p => p.isPending).length,
      complete: result.filter(p => !p.isPending).length,
    };

    res.json({ state: state || null, promoters: result, summary });
  } catch (error) {
    console.error('Get pending overview error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Histórico de faltas por promotor (indústrias não fotografadas, com justificativa).
 * GET /supervisors/promoters/:id/miss-history?days=30
 */
export async function getPromoterMissHistory(req: AuthRequest, res: Response) {
  try {
    const { id: promoterId } = req.params;
    const days = Math.min(Math.max(parseInt((req.query.days as string) || '30', 10) || 30, 1), 180);

    // Escopo: supervisor só vê promotores do seu escopo (ou admin via requireSupervisor)
    // getScopedPromoters já implementa regra, então reaproveitamos a mesma lógica via query.
    const requesterId = req.userId!;
    const requesterRole = req.userRole;

    if (requesterRole !== UserRole.ADMIN) {
      const allowed = await prisma.user.count({
        where: {
          id: promoterId,
          role: UserRole.PROMOTER,
          OR: [
            { promoterSupervisors: { some: { supervisorId: requesterId } } },
            { routeAssignments: { some: { supervisorId: requesterId, isActive: true } } },
          ],
        },
      });
      if (!allowed) return res.status(403).json({ message: 'Acesso não autorizado' });
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const misses = await prisma.industryMiss.findMany({
      where: { promoterId, createdAt: { gte: start } },
      include: {
        store: { select: { id: true, name: true, state: true } },
        industry: { select: { id: true, name: true, abbreviation: true, code: true } },
        visit: { select: { id: true, checkInAt: true, checkOutAt: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    // Agregar por dia para KPI simples
    const byDay = new Map<string, number>();
    for (const m of misses) {
      const day = m.createdAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + 1);
    }

    res.json({
      promoterId,
      days,
      start: start.toISOString().slice(0, 10),
      total: misses.length,
      byDay: Array.from(byDay.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count })),
      misses: misses.map((m) => ({
        id: m.id,
        createdAt: m.createdAt,
        reason: m.reason,
        note: m.note,
        store: m.store,
        industry: m.industry,
        visit: m.visit,
      })),
    });
  } catch (error) {
    console.error('Get promoter miss history error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Retorna promotores vinculados ao supervisor via PromoterSupervisor
 */
export async function getScopedPromoters(req: AuthRequest, res: Response) {
  try {
    const isAdmin = req.userRole === UserRole.ADMIN;
    const supervisorId = req.userId!;

    const where: any = { role: UserRole.PROMOTER };
    if (!isAdmin) {
      where.OR = [
        { promoterSupervisors: { some: { supervisorId } } },
        { routeAssignments: { some: { supervisorId, isActive: true } } },
      ];
    }

    const promoters = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        state: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({ promoters });
  } catch (error) {
    console.error('Get scoped promoters error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

