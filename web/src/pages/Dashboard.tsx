import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supervisorService } from '../services/supervisorService';
import Card, { CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';

interface IndustryStatus {
  id: string;
  name: string;
  code: string;
  hasCoverage: boolean;
  photoCount: number;
}

interface StoreOverview {
  id: string;
  name: string;
  lastVisitAt: string | null;
  lastVisitCompleted: boolean;
  industries: IndustryStatus[];
  totalRequired: number;
  totalCovered: number;
}

interface PromoterOverview {
  id: string;
  name: string;
  email: string;
  state: string | null;
  stores: StoreOverview[];
  totalRequired: number;
  totalCovered: number;
  isPending: boolean;
}

interface PendingOverviewResponse {
  state: string | null;
  promoters: PromoterOverview[];
  summary: { total: number; pending: number; complete: number };
}

export default function Dashboard() {
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [expandedPromoter, setExpandedPromoter] = useState<string | null>(null);
  const [expandedStore, setExpandedStore] = useState<string | null>(null);

  const { data: statesData } = useQuery({
    queryKey: ['supervisor', 'my-states'],
    queryFn: () => supervisorService.getMyStates(),
  });

  const states = statesData?.states || [];

  const activeState = selectedState || (states.length > 0 ? states[0] : null);

  const { data: overviewData, isLoading } = useQuery<PendingOverviewResponse>({
    queryKey: ['supervisor', 'pending-overview', activeState],
    queryFn: () => supervisorService.getPendingOverview(activeState || undefined),
    enabled: states.length > 0,
  });

  const promoters = overviewData?.promoters || [];
  const summary = overviewData?.summary || { total: 0, pending: 0, complete: 0 };

  if (states.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardContent>
            <div className="text-center py-8">
              <div className="text-5xl mb-4">🗺️</div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                Nenhum estado atribuído
              </h2>
              <p className="text-text-secondary">
                Peça a um administrador para atribuir estados à sua conta de supervisor.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  function togglePromoter(id: string) {
    setExpandedPromoter(prev => prev === id ? null : id);
    setExpandedStore(null);
  }

  function toggleStore(key: string) {
    setExpandedStore(prev => prev === key ? null : key);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Painel do Supervisor</h1>
        <p className="text-text-secondary text-sm mt-1">
          Acompanhe o trabalho dos promotores por estado
        </p>
      </div>

      {/* Seletor de Estado */}
      <div className="flex flex-wrap gap-2">
        {states.map((st) => (
          <button
            key={st}
            onClick={() => { setSelectedState(st); setExpandedPromoter(null); }}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              activeState === st
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                : 'bg-dark-card border border-dark-border text-text-secondary hover:border-primary-600 hover:text-text-primary'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <p className="text-sm text-text-secondary mb-1">Total Promotores</p>
            <p className="text-3xl font-bold text-text-primary">{summary.total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent>
            <p className="text-sm text-text-secondary mb-1">Pendentes</p>
            <p className="text-3xl font-bold text-red-400">{summary.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent>
            <p className="text-sm text-text-secondary mb-1">Completos</p>
            <p className="text-3xl font-bold text-emerald-400">{summary.complete}</p>
          </CardContent>
        </Card>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Lista de Promotores */}
      {!isLoading && promoters.length === 0 && (
        <div className="text-center py-12 text-text-secondary">
          Nenhum promotor encontrado neste estado.
        </div>
      )}

      <div className="space-y-3">
        {promoters.map((promoter) => {
          const isExpanded = expandedPromoter === promoter.id;
          const progress = promoter.totalRequired > 0
            ? Math.round((promoter.totalCovered / promoter.totalRequired) * 100)
            : 100;

          return (
            <Card key={promoter.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Promoter Header */}
                <button
                  onClick={() => togglePromoter(promoter.id)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-dark-cardElevated transition-colors text-left"
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    promoter.isPending
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                  }`}>
                    {promoter.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-text-primary truncate">
                        {promoter.name}
                      </span>
                      {promoter.state && (
                        <span className="text-xs text-text-tertiary bg-dark-backgroundSecondary px-2 py-0.5 rounded">
                          {promoter.state}
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-dark-backgroundSecondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            progress === 100 ? 'bg-emerald-500' : progress > 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-tertiary whitespace-nowrap">
                        {promoter.totalCovered}/{promoter.totalRequired}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0">
                    {promoter.isPending ? (
                      <Badge variant="error">Pendente</Badge>
                    ) : (
                      <Badge variant="success">Completo</Badge>
                    )}
                  </div>

                  {/* Chevron */}
                  <svg
                    className={`w-5 h-5 text-text-tertiary transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-dark-border bg-dark-backgroundSecondary/50">
                    <div className="p-4 space-y-3">
                      {promoter.stores.length === 0 && (
                        <p className="text-sm text-text-tertiary">Nenhuma loja atribuída.</p>
                      )}
                      {promoter.stores.map((store) => {
                        const storeKey = `${promoter.id}-${store.id}`;
                        const isStoreExpanded = expandedStore === storeKey;
                        const storeCoverage = store.totalRequired > 0
                          ? Math.round((store.totalCovered / store.totalRequired) * 100)
                          : 100;
                        const allCovered = store.totalRequired > 0 && store.totalCovered >= store.totalRequired;

                        return (
                          <div key={store.id} className="bg-dark-card rounded-lg border border-dark-border overflow-hidden">
                            <button
                              onClick={() => toggleStore(storeKey)}
                              className="w-full flex items-center justify-between p-3 hover:bg-dark-cardElevated transition-colors text-left"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-sm font-medium text-text-primary truncate">
                                  {store.name}
                                </span>
                                {store.lastVisitAt && (
                                  <span className="text-xs text-text-tertiary hidden sm:inline">
                                    Última visita: {new Date(store.lastVisitAt).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs font-medium ${allCovered ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {store.totalCovered}/{store.totalRequired}
                                </span>
                                <svg
                                  className={`w-4 h-4 text-text-tertiary transition-transform ${isStoreExpanded ? 'rotate-180' : ''}`}
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>

                            {isStoreExpanded && store.industries.length > 0 && (
                              <div className="border-t border-dark-border p-3">
                                <div className="flex flex-wrap gap-2">
                                  {store.industries.map((ind) => (
                                    <div
                                      key={ind.id}
                                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                                        ind.hasCoverage
                                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                          : 'bg-red-500/10 text-red-400 border border-red-500/30'
                                      }`}
                                    >
                                      <span className={`w-2 h-2 rounded-full ${ind.hasCoverage ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                      {ind.name}
                                      {ind.photoCount > 0 && (
                                        <span className="text-text-tertiary">({ind.photoCount})</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Link para detalhes */}
                      <div className="pt-2">
                        <Link
                          to={`/promoters/${promoter.id}`}
                          className="inline-flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 transition-colors font-medium"
                        >
                          Ver detalhes completos
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
