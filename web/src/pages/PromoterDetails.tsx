import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supervisorService } from '../services/supervisorService';
import { format } from 'date-fns';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import PhotoGallery from '../components/PhotoGallery';

type PhotoWithIndustry = {
  type?: string;
  url: string;
  industryAbbreviation?: string | null;
  industryName?: string | null;
};

function getIndustryLabel(photo: PhotoWithIndustry) {
  if (photo.industryAbbreviation) return photo.industryAbbreviation;
  if (photo.industryName) return photo.industryName;
  return '—';
}

function getWorkPhotos(visit: {
  photos?: PhotoWithIndustry[];
  checkInPhotoUrl?: string | null;
  checkOutPhotoUrl?: string | null;
}): PhotoWithIndustry[] {
  const photos = visit.photos || [];
  return photos.filter(
    (p) => (p.type === 'OTHER' || !p.type) && p.url !== visit.checkInPhotoUrl && p.url !== visit.checkOutPhotoUrl
  );
}

/** Agrupa fotos de trabalho por indústria (label). Retorna array de { industryLabel, photos }. */
function groupPhotosByIndustry(workPhotos: PhotoWithIndustry[]) {
  const byIndustry = new Map<string, any[]>();
  for (const p of workPhotos) {
    const label = getIndustryLabel(p);
    if (!byIndustry.has(label)) byIndustry.set(label, []);
    byIndustry.get(label)!.push(p);
  }
  const entries = Array.from(byIndustry.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([industryLabel, photos]) => ({ industryLabel, photos }));
}

const PLACEHOLDER_IMG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120"%3E%3Crect fill="%23241F35" width="120" height="120"/%3E%3Ctext fill="%239CA3AF" font-size="11" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ESem imagem%3C/text%3E%3C/svg%3E';

export default function PromoterDetails() {
  const { id } = useParams<{ id: string }>();
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterStoreId, setFilterStoreId] = useState('');
  const [filterState, setFilterState] = useState('');

  const { data: visitsData, isLoading: loadingVisits } = useQuery({
    queryKey: ['promoter-visits', id],
    queryFn: () => supervisorService.getPromoterVisits(id!, 1, 200),
    enabled: !!id,
  });

  const { data: myStatesData } = useQuery({
    queryKey: ['supervisor', 'my-states'],
    queryFn: () => supervisorService.getMyStates(),
  });

  const visitsList = visitsData?.visits || [];
  const supervisorStates = myStatesData?.states ?? [];

  const { filterOptions, filteredVisits } = useMemo(() => {
    const dates = new Set<string>();
    const industries = new Set<string>();
    const stores: { id: string; name: string }[] = [];
    const storeIds = new Set<string>();

    for (const v of visitsList) {
      const d = format(new Date((v as { checkInAt: string | Date }).checkInAt), 'yyyy-MM-dd');
      dates.add(d);
      const vStore = (v as { store?: { id: string; name?: string } }).store;
      if (vStore?.id && !storeIds.has(vStore.id)) {
        storeIds.add(vStore.id);
        stores.push({ id: vStore.id, name: vStore.name || '—' });
      }
      const work = getWorkPhotos(v as Parameters<typeof getWorkPhotos>[0]);
      for (const p of work) {
        const lbl = getIndustryLabel(p);
        if (lbl !== '—') industries.add(lbl);
      }
    }

    const filterOptions = {
      dates: Array.from(dates).sort().reverse(),
      industries: Array.from(industries).sort(),
      stores: stores.sort((a, b) => a.name.localeCompare(b.name)),
    };

    let filtered = visitsList;
    if (filterState) {
      filtered = filtered.filter((v: { store?: { state?: string } }) => (v.store?.state ?? '') === filterState);
    }
    if (filterDate) {
      filtered = filtered.filter((v: { checkInAt: string | Date }) => format(new Date(v.checkInAt), 'yyyy-MM-dd') === filterDate);
    }
    if (filterStoreId) {
      filtered = filtered.filter((v: { store?: { id?: string } }) => v.store?.id === filterStoreId);
    }
    if (filterIndustry) {
      filtered = filtered.filter((v: Parameters<typeof getWorkPhotos>[0]) => {
        const work = getWorkPhotos(v);
        return work.some((p) => getIndustryLabel(p) === filterIndustry);
      });
    }

    return { filterOptions, filteredVisits: filtered };
  }, [visitsList, filterState, filterDate, filterStoreId, filterIndustry]);

  const promoterName = visitsList[0]?.promoterName ?? 'Promotor';

  if (loadingVisits) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <div className="text-text-secondary">Carregando visitas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary-400 hover:text-primary-300 mb-3 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar ao Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-600 to-amber-500 flex items-center justify-center text-white font-bold text-lg shadow-lg ring-2 ring-dark-border">
              {promoterName.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-xl font-bold text-text-primary">{promoterName}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/routes/config">
            <Button variant="outline" size="sm">Configurar Rota</Button>
          </Link>
          <Link to={`/promoters/${id}/route`}>
            <Button variant="accent" size="sm">Ver Mapa</Button>
          </Link>
        </div>
      </div>

      {/* Botões de estado (siglas que o supervisor atende) */}
      {supervisorStates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider mr-1">Estado:</span>
          <button
            type="button"
            onClick={() => setFilterState('')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !filterState
                ? 'bg-primary-600 text-white'
                : 'bg-dark-card border border-dark-border text-text-secondary hover:border-primary-500/50 hover:text-primary-400'
            }`}
          >
            Todos
          </button>
          {supervisorStates.sort().map((uf: string) => (
            <button
              key={uf}
              type="button"
              onClick={() => setFilterState(uf)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterState === uf
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-card border border-dark-border text-text-secondary hover:border-primary-500/50 hover:text-primary-400'
              }`}
            >
              {uf}
            </button>
          ))}
        </div>
      )}

      {/* Filtros */}
      <Card className="border-dark-border">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[140px]">
              <label className="block text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Data</label>
              <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-card text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-600"
              >
                <option value="">Todas as datas</option>
                {filterOptions.dates.map((d) => (
                  <option key={d} value={d}>{format(new Date(d + 'T12:00:00'), 'dd/MM/yyyy')}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[160px]">
              <label className="block text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Indústria</label>
              <select
                value={filterIndustry}
                onChange={(e) => setFilterIndustry(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-card text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-600"
              >
                <option value="">Todas</option>
                {filterOptions.industries.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[180px]">
              <label className="block text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Loja</label>
              <select
                value={filterStoreId}
                onChange={(e) => setFilterStoreId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-card text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-600"
              >
                <option value="">Todas as lojas</option>
                {filterOptions.stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {(filterDate || filterIndustry || filterStoreId || filterState) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setFilterDate(''); setFilterIndustry(''); setFilterStoreId(''); setFilterState(''); }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de visitas */}
      {filteredVisits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-text-tertiary text-sm">
            {visitsList.length === 0 ? 'Nenhuma visita encontrada.' : 'Nenhuma visita corresponde aos filtros.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {filteredVisits.map((visit: any, visitIndex: number) => {
            const workPhotos = getWorkPhotos(visit);
            const storeName = visit.store?.name || '—';
            const visitDateStr = format(new Date(visit.checkInAt), 'dd/MM/yyyy');
            const checkInStr = format(new Date(visit.checkInAt), 'HH:mm');
            const checkOutStr = visit.checkOutAt ? format(new Date(visit.checkOutAt), 'HH:mm') : '—';
            const hoursStr = visit.hoursWorked ? `${visit.hoursWorked}h` : '—';
            const byIndustry = groupPhotosByIndustry(workPhotos);

            return (
              <Card key={visit.id} className="overflow-hidden border border-dark-border bg-dark-card shadow-card">
                {/* Bloco da visita: barra lateral + conteúdo */}
                <div className="flex">
                  <div className="w-1 flex-shrink-0 bg-gradient-to-b from-primary-600 to-amber-500 rounded-l-lg" />
                  <div className="flex-1 min-w-0">
                    {/* Cabeçalho da visita — compacto */}
                    <div className="px-5 py-4 border-b border-dark-border bg-dark-backgroundSecondary/50">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="font-semibold text-primary-400">Visita {visitIndex + 1}</span>
                        <span className="text-text-primary">{visitDateStr}</span>
                        <span className="text-text-secondary">{storeName}</span>
                        <span className="text-text-tertiary">{checkInStr} → {checkOutStr}</span>
                        {hoursStr !== '—' && <span className="text-text-tertiary">({hoursStr})</span>}
                      </div>
                    </div>

                    {/* Fotos agrupadas por indústria — thumbnails menores */}
                    <div className="px-5 py-4 space-y-6">
                      {byIndustry.length === 0 ? (
                        <p className="text-text-tertiary text-sm">Nenhuma foto de trabalho nesta visita.</p>
                      ) : (
                        byIndustry.map(({ industryLabel, photos }) => (
                          <div key={industryLabel}>
                            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
                              <span className="w-1 h-4 rounded-full bg-primary-500" />
                              {industryLabel}
                              <span className="text-text-tertiary font-normal">({photos.length})</span>
                            </h3>
                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                              {photos.map((photo: any, idx: number) => (
                                <button
                                  key={photo.id || idx}
                                  type="button"
                                  className="relative rounded-lg overflow-hidden bg-dark-backgroundSecondary aspect-square focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2 focus:ring-offset-dark-card group"
                                  onClick={() => {
                                    setSelectedVisit(visit);
                                    setIsGalleryOpen(true);
                                  }}
                                >
                                  <img
                                    src={photo.url}
                                    alt=""
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }}
                                  />
                                  <div className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 px-1.5 text-[10px] text-white truncate">
                                    {photo.createdAt ? format(new Date(photo.createdAt), 'dd/MM HH:mm') : '—'}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))
                      )}

                      {workPhotos.length > 0 && (
                        <div className="pt-2 border-t border-dark-border">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setSelectedVisit(visit); setIsGalleryOpen(true); }}
                          >
                            Ver todas as fotos desta visita
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {selectedVisit && (
        <PhotoGallery
          photos={selectedVisit.photos || []}
          checkInPhotoUrl={selectedVisit.checkInPhotoUrl}
          checkOutPhotoUrl={selectedVisit.checkOutPhotoUrl}
          isOpen={isGalleryOpen}
          onClose={() => { setIsGalleryOpen(false); setSelectedVisit(null); }}
          visitDate={format(new Date(selectedVisit.checkInAt), "dd/MM/yyyy 'às' HH:mm")}
          storeName={selectedVisit.store?.name}
          promoterName={selectedVisit.promoterName}
        />
      )}
    </div>
  );
}
