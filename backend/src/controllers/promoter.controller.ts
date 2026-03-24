import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import prisma from '../prisma/client';
import { PhotoType } from '../types';

const checkInSchema = z.object({
  storeId: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
  photoUrl: z.string().url(),
});

export async function checkIn(req: AuthRequest, res: Response) {
  try {
    const { storeId, latitude, longitude, photoUrl } = checkInSchema.parse(req.body);
    const promoterId = req.userId!;

    // Verificar se o promotor já tem uma visita em aberto
    const activeVisit = await prisma.visit.findFirst({
      where: {
        promoterId,
        checkOutAt: null,
      },
    });

    if (activeVisit) {
      return res.status(400).json({
        message: 'Você já tem uma visita em andamento. Faça checkout primeiro.',
        visitId: activeVisit.id,
      });
    }

    // Verificar se a loja existe
    const store = await prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    // Não permitir nova visita na mesma loja no mesmo dia (já fez checkout hoje)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const alreadyDoneToday = await prisma.visit.findFirst({
      where: {
        promoterId,
        storeId,
        checkOutAt: { not: null },
        checkInAt: { gte: todayStart, lt: todayEnd },
      },
    });

    if (alreadyDoneToday) {
      return res.status(400).json({
        message: 'Você já realizou visita nesta loja hoje. Não é possível fazer nova visita no mesmo dia.',
      });
    }

    // Criar visita
    const visit = await prisma.visit.create({
      data: {
        promoterId,
        storeId,
        checkInAt: new Date(),
        checkInLatitude: latitude,
        checkInLongitude: longitude,
        checkInPhotoUrl: photoUrl,
      },
      include: {
        store: true,
      },
    });

    // Criar registro da foto
    await prisma.photo.create({
      data: {
        visitId: visit.id,
        url: photoUrl,
        type: PhotoType.FACADE_CHECKIN,
        latitude,
        longitude,
      },
    });

    res.json({
      visit: {
        id: visit.id,
        store: visit.store,
        checkInAt: visit.checkInAt,
        checkInLatitude: visit.checkInLatitude,
        checkInLongitude: visit.checkInLongitude,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    console.error('Check-in error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

const checkOutSchema = z.object({
  visitId: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
  photoUrl: z.string().url(),
});

export async function checkOut(req: AuthRequest, res: Response) {
  try {
    const { visitId, latitude, longitude, photoUrl } = checkOutSchema.parse(req.body);
    const promoterId = req.userId!;

    // Verificar se a visita existe e pertence ao promotor
    const visit = await prisma.visit.findFirst({
      where: {
        id: visitId,
        promoterId,
      },
    });

    if (!visit) {
      return res.status(404).json({ message: 'Visita não encontrada' });
    }

    if (visit.checkOutAt) {
      return res.status(400).json({ message: 'Visita já foi finalizada' });
    }

    // Atualizar visita com checkout
    const updatedVisit = await prisma.visit.update({
      where: { id: visitId },
      data: {
        checkOutAt: new Date(),
        checkOutLatitude: latitude,
        checkOutLongitude: longitude,
        checkOutPhotoUrl: photoUrl,
      },
      include: {
        store: true,
      },
    });

    // Criar registro da foto de checkout
    await prisma.photo.create({
      data: {
        visitId: visit.id,
        url: photoUrl,
        type: PhotoType.FACADE_CHECKOUT,
        latitude,
        longitude,
      },
    });

    // Calcular horas trabalhadas
    const hoursWorked = updatedVisit.checkOutAt 
      ? (updatedVisit.checkOutAt.getTime() - updatedVisit.checkInAt.getTime()) / (1000 * 60 * 60)
      : 0;

    res.json({
      visit: {
        id: updatedVisit.id,
        store: updatedVisit.store,
        checkInAt: updatedVisit.checkInAt,
        checkOutAt: updatedVisit.checkOutAt,
        hoursWorked: hoursWorked.toFixed(2),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    console.error('Checkout error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

const uploadPhotosSchema = z.object({
  visitId: z.string().uuid(),
  photos: z.array(
    z.object({
      url: z.string().url(),
      type: z.nativeEnum(PhotoType),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      industryId: z.string().uuid().optional(),
    })
  ),
});

export async function uploadPhotos(req: AuthRequest, res: Response) {
  try {
    const { visitId, photos } = uploadPhotosSchema.parse(req.body);
    const promoterId = req.userId!;

    console.log(`📸 [uploadPhotos] visitId=${visitId}, ${photos.length} foto(s), coords:`, 
      photos.map(p => ({ type: p.type, lat: p.latitude, lng: p.longitude, industryId: p.industryId }))
    );

    // Verificar se a visita existe e pertence ao promotor
    const visit = await prisma.visit.findFirst({
      where: {
        id: visitId,
        promoterId,
      },
    });

    if (!visit) {
      return res.status(404).json({ message: 'Visita não encontrada' });
    }

    // Processar cada foto
    // Para FACADE_CHECKIN e FACADE_CHECKOUT: apenas uma por visita (atualizar se existir)
    // Para OTHER: permitir múltiplas fotos (sempre criar nova)
    // Processamento sequencial reduz picos de conexões com poolers (ex.: Supabase/pgBouncer)
    const createdPhotos: any[] = [];
    for (const photo of photos) {
        // Para fotos de check-in e check-out, verificar se já existe e atualizar
        if (photo.type === PhotoType.FACADE_CHECKIN || photo.type === PhotoType.FACADE_CHECKOUT) {
          const existingPhoto = await prisma.photo.findFirst({
            where: {
              visitId,
              type: photo.type,
            },
          });

          if (existingPhoto) {
            // Atualizar foto existente (especialmente para substituir URLs placeholder)
            const updated = await prisma.photo.update({
              where: { id: existingPhoto.id },
              data: {
                url: photo.url,
                latitude: photo.latitude ?? existingPhoto.latitude,
                longitude: photo.longitude ?? existingPhoto.longitude,
              },
            });
            console.log(`✅ Foto ${photo.type} atualizada: ${existingPhoto.url} -> ${photo.url}`);
            createdPhotos.push(updated);
            continue;
          }
        }
        
        const created = await prisma.photo.create({
          data: {
            visitId,
            url: photo.url,
            type: photo.type,
            latitude: photo.latitude ?? null,
            longitude: photo.longitude ?? null,
            selectedIndustryId: photo.industryId ?? null,
          },
        });
        console.log(`✅ Nova foto ${photo.type} criada: ${photo.url}`);

        if (photo.industryId && created.id) {
          try {
            await prisma.photoIndustry.create({
              data: {
                photoId: created.id,
                industryId: photo.industryId,
                promoterId,
                storeId: visit.storeId,
                visitId,
              },
            });
            console.log(`✅ Foto associada à indústria ${photo.industryId}`);
          } catch (assocError) {
            console.warn('⚠️ Erro ao associar foto à indústria:', assocError);
          }
        }
        createdPhotos.push(created);
    }

    // Atualizar também checkInPhotoUrl e checkOutPhotoUrl na tabela Visit se necessário
    const checkInPhoto = photos.find(p => p.type === PhotoType.FACADE_CHECKIN);
    const checkOutPhoto = photos.find(p => p.type === PhotoType.FACADE_CHECKOUT);
    
    if (checkInPhoto && !checkInPhoto.url.includes('placeholder.com')) {
      await prisma.visit.update({
        where: { id: visitId },
        data: { checkInPhotoUrl: checkInPhoto.url },
      });
      console.log(`✅ checkInPhotoUrl atualizado na visita: ${checkInPhoto.url}`);
    }
    
    if (checkOutPhoto && !checkOutPhoto.url.includes('placeholder.com')) {
      await prisma.visit.update({
        where: { id: visitId },
        data: { checkOutPhotoUrl: checkOutPhoto.url },
      });
      console.log(`✅ checkOutPhotoUrl atualizado na visita: ${checkOutPhoto.url}`);
    }

    res.json({
      photos: createdPhotos,
      count: createdPhotos.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    console.error('Upload photos error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

const priceResearchSchema = z.object({
  visitId: z.string().uuid(),
  storeId: z.string().uuid(),
  productName: z.string().min(1),
  price: z.number().positive(),
  competitorPrices: z.array(
    z.object({
      competitorName: z.string().min(1),
      price: z.number().positive(),
    })
  ),
});

export async function submitPriceResearch(req: AuthRequest, res: Response) {
  try {
    const { visitId, storeId, productName, price, competitorPrices } = priceResearchSchema.parse(req.body);
    const promoterId = req.userId!;

    // Verificar se a visita existe e pertence ao promotor
    const visit = await prisma.visit.findFirst({
      where: {
        id: visitId,
        promoterId,
      },
    });

    if (!visit) {
      return res.status(404).json({ message: 'Visita não encontrada' });
    }

    // Criar pesquisa de preço
    const priceResearch = await prisma.priceResearch.create({
      data: {
        visitId,
        storeId,
        productName,
        price,
        competitorPrices: competitorPrices as any,
      },
    });

    res.json({
      priceResearch,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    console.error('Price research error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getStores(req: AuthRequest, res: Response) {
  try {
    const promoterId = req.userId!;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const completedToday = await prisma.visit.findMany({
      where: {
        promoterId,
        checkOutAt: { not: null },
        checkInAt: { gte: todayStart, lt: todayEnd },
      },
      select: { storeId: true },
    });
    const completedStoreIdsToday = [...new Set(completedToday.map((v: { storeId: string }) => v.storeId))];

    // Buscar lojas atribuídas ao promotor (rota configurada)
    const routeAssignments = await prisma.routeAssignment.findMany({
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

    // Se o promotor tem rota configurada, retornar apenas essas lojas
    if (routeAssignments.length > 0) {
      return res.json({
        stores: routeAssignments.map((a: { store: any }) => a.store),
        hasRoute: true,
        completedStoreIdsToday,
      });
    }

    // Caso contrário, retornar todas as lojas (compatibilidade com versão antiga)
    const stores = await prisma.store.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    res.json({ stores, hasRoute: false, completedStoreIdsToday });
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getCurrentVisit(req: AuthRequest, res: Response) {
  try {
    const promoterId = req.userId!;

    // Buscar visita em aberto
    const visit = await prisma.visit.findFirst({
      where: {
        promoterId,
        checkOutAt: null,
      },
      include: {
        store: true,
        photos: {
          include: {
            photoIndustries: {
              select: { industryId: true },
            },
          },
          orderBy: [
            { type: 'asc' },
            { createdAt: 'asc' },
          ],
        },
      },
      orderBy: {
        checkInAt: 'desc',
      },
    });

    if (!visit) {
      return res.json({ visit: null });
    }

    res.json({
      visit: {
        id: visit.id,
        store: visit.store,
        checkInAt: visit.checkInAt,
        checkInLatitude: visit.checkInLatitude,
        checkInLongitude: visit.checkInLongitude,
        photos: visit.photos.map((photo: any) => ({
          id: photo.id,
          url: photo.url,
          type: photo.type,
          latitude: photo.latitude,
          longitude: photo.longitude,
          createdAt: photo.createdAt,
          industryId: photo.selectedIndustryId
            || (photo.photoIndustries && photo.photoIndustries.length > 0
              ? photo.photoIndustries[0].industryId
              : null),
        })),
      },
    });
  } catch (error) {
    console.error('Get current visit error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getVisits(req: AuthRequest, res: Response) {
  try {
    const promoterId = req.userId!;
    const { page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Executar sequencialmente para reduzir concorrência de statements no pooler.
    const visits = await prisma.visit.findMany({
      where: { promoterId },
      include: {
        store: true,
        photos: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        checkInAt: 'desc',
      },
      skip,
      take: limitNum,
    });

    const total = await prisma.visit.count({
      where: { promoterId },
    });

    res.json({
      visits: visits.map((visit: any) => ({
        id: visit.id,
        store: visit.store,
        checkInAt: visit.checkInAt,
        checkOutAt: visit.checkOutAt,
        hoursWorked: visit.checkOutAt
          ? ((visit.checkOutAt.getTime() - visit.checkInAt.getTime()) / (1000 * 60 * 60)).toFixed(2)
          : null,
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
    console.error('Get visits error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Obter resumo do dia do promotor
 */
export async function getDailySummary(req: AuthRequest, res: Response) {
  try {
    const promoterId = req.userId;
    if (!promoterId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Data de hoje (início e fim do dia)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Buscar todas as visitas do dia
    const visits = await prisma.visit.findMany({
      where: {
        promoterId,
        checkInAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        photos: {
          select: {
            id: true,
          },
        },
        store: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        checkInAt: 'asc',
      },
    });

    // Calcular métricas
    const totalVisits = visits.length;
    const completedVisits = visits.filter((v: any) => v.checkOutAt !== null).length;
    const inProgressVisits = visits.filter((v: any) => v.checkOutAt === null).length;
    
    // Calcular total de horas trabalhadas
    let totalHours = 0;
    visits.forEach((visit: any) => {
      if (visit.checkInAt && visit.checkOutAt) {
        const checkIn = new Date(visit.checkInAt);
        const checkOut = new Date(visit.checkOutAt);
        const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
        totalHours += hours;
      }
    });

    // Total de fotos enviadas
    const totalPhotos = visits.reduce((sum: number, visit: any) => sum + visit.photos.length, 0);

    // Meta de fotos (assumindo 20 fotos por visita como padrão)
    const photoGoalPerVisit = 20;
    const photoGoal = totalVisits * photoGoalPerVisit;
    const photoCompliance = photoGoal > 0 ? (totalPhotos / photoGoal) * 100 : 100;

    res.json({
      totalVisits,
      totalHours: parseFloat(totalHours.toFixed(2)),
      completedVisits,
      inProgressVisits,
      totalPhotos,
      photoGoal,
      photoCompliance: parseFloat(photoCompliance.toFixed(1)),
      status: photoCompliance >= 80 ? 'conforme' : photoCompliance >= 50 ? 'atencao' : 'fora_meta',
    });
  } catch (error) {
    console.error('Erro ao obter resumo do dia:', error);
    res.status(500).json({ error: 'Erro ao obter resumo do dia' });
  }
}

/**
 * Indústrias da visita: se o promotor já tem IndustryAssignment para esta loja, retorna essas + needsOnboarding false; senão retorna StoreIndustry + needsOnboarding true.
 * GET /promoters/visits/:visitId/industries
 */
export async function getVisitIndustries(req: AuthRequest, res: Response) {
  try {
    const { visitId } = req.params;
    const promoterId = req.userId!;

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        store: {
          include: {
            storeIndustries: {
              where: { isActive: true },
              include: { industry: true },
            },
          },
        },
      },
    });

    if (!visit) {
      return res.status(404).json({ message: 'Visita não encontrada' });
    }
    if (visit.promoterId !== promoterId) {
      return res.status(403).json({ message: 'Acesso não autorizado' });
    }

    const storeId = visit.storeId;
    const assignments = await prisma.industryAssignment.findMany({
      where: {
        promoterId,
        storeId,
        isActive: true,
      },
      include: { industry: true },
      orderBy: { industry: { name: 'asc' } },
    });

    if (assignments.length > 0) {
      return res.json({
        visitId: visit.id,
        storeId,
        needsOnboarding: false,
        industries: assignments.map(a => a.industry),
      });
    }

    const storeIndustries = visit.store.storeIndustries;
    const industries = storeIndustries.map(si => si.industry);
    return res.json({
      visitId: visit.id,
      storeId,
      needsOnboarding: true,
      industries,
    });
  } catch (error) {
    console.error('Get visit industries error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Verificar cobertura de indústrias em uma visita.
 * Usa IndustryAssignment (promoter+store) como "required" quando existir; senão StoreIndustry.
 * GET /promoters/visits/:visitId/coverage
 */
export async function getVisitCoverage(req: AuthRequest, res: Response) {
  try {
    const { visitId } = req.params;
    const promoterId = req.userId;

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        store: {
          include: {
            storeIndustries: {
              where: { isActive: true },
              include: { industry: true },
            },
          },
        },
        promoter: {
          select: { id: true, name: true },
        },
      },
    });

    if (!visit) {
      return res.status(404).json({ message: 'Visita não encontrada' });
    }

    if (promoterId && visit.promoterId !== promoterId) {
      const user = await prisma.user.findUnique({
        where: { id: promoterId },
        select: { role: true },
      });
      if (user?.role === 'PROMOTER') {
        return res.status(403).json({ message: 'Acesso não autorizado' });
      }
    }

    const photosWithIndustry = await prisma.photoIndustry.findMany({
      where: { visitId },
      select: { industryId: true },
    });
    const coveredIds = new Set(photosWithIndustry.map(p => p.industryId));

    // Required: IndustryAssignment (promoter + store) se existir; senão StoreIndustry
    let requiredList: { industryId: string; industry: any }[];
    const assignments = await prisma.industryAssignment.findMany({
      where: {
        promoterId: visit.promoterId,
        storeId: visit.storeId,
        isActive: true,
      },
      include: { industry: true },
    });

    if (assignments.length > 0) {
      requiredList = assignments.map(a => ({ industryId: a.industryId, industry: a.industry }));
    } else {
      requiredList = visit.store.storeIndustries.map(si => ({
        industryId: si.industryId,
        industry: si.industry,
      }));
    }

    const coverage = requiredList.map(({ industryId, industry }) => ({
      industry,
      covered: coveredIds.has(industryId),
      photoCount: photosWithIndustry.filter(p => p.industryId === industryId).length,
    }));

    const pending = coverage.filter(c => !c.covered);
    const covered = coverage.filter(c => c.covered);

    res.json({
      visitId: visit.id,
      storeId: visit.storeId,
      storeName: visit.store.name,
      promoter: visit.promoter,
      coverage,
      pending,
      covered,
      isComplete: pending.length === 0,
      totalRequired: requiredList.length,
      totalCovered: covered.length,
      percentComplete: requiredList.length > 0
        ? Math.round((covered.length / requiredList.length) * 100)
        : 100,
    });
  } catch (error) {
    console.error('Get visit coverage error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

