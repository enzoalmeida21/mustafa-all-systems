import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supervisorService } from '../services/supervisorService';
import { adminService } from '../services/adminService';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';

interface Store {
  id: string;
  name: string;
  address: string;
  state?: string | null;
  latitude: number;
  longitude: number;
}

interface RouteSupervisor {
  id: string;
  name: string;
}

interface RouteStoreEntry {
  id: string;
  store: { id: string; name: string; address: string };
  order: number;
  supervisor: RouteSupervisor | null;
}

interface RouteEntry {
  promoter: { id: string; name: string; email: string };
  stores: RouteStoreEntry[];
  totalStores: number;
}

export default function RouteConfig() {
  const queryClient = useQueryClient();
  const [storeSearch, setStoreSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [selectedPromoters, setSelectedPromoters] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [expandedPromoter, setExpandedPromoter] = useState<string | null>(null);
  const [editingSupervisor, setEditingSupervisor] = useState<{ promoterId: string; storeId: string } | null>(null);
  const [industryModal, setIndustryModal] = useState<{ promoterId: string; promoterName: string; storeId: string; storeName: string } | null>(null);
  const [industryModalSelectedIds, setIndustryModalSelectedIds] = useState<Set<string>>(new Set());

  const { data: routesData, isLoading: loadingRoutes } = useQuery({
    queryKey: ['all-routes'],
    queryFn: () => supervisorService.getAllRoutes(),
  });

  const { data: storesData } = useQuery({
    queryKey: ['available-stores'],
    queryFn: () => supervisorService.getAvailableStores(),
  });

  const { data: promotersData } = useQuery({
    queryKey: ['promoters'],
    queryFn: () => supervisorService.getPromoters(),
  });

  const { data: supervisorsData } = useQuery({
    queryKey: ['supervisors-list'],
    queryFn: () => supervisorService.getSupervisorsList(),
  });

  const { data: storeIndustriesData } = useQuery({
    queryKey: ['store-industries', industryModal?.storeId],
    queryFn: () => supervisorService.getStoreIndustries(industryModal!.storeId),
    enabled: !!industryModal?.storeId,
  });

  const { data: promoterAssignmentsData } = useQuery({
    queryKey: ['promoter-industry-assignments', industryModal?.promoterId],
    queryFn: () => adminService.getPromoterIndustryAssignments(industryModal!.promoterId),
    enabled: !!industryModal?.promoterId,
  });

  useEffect(() => {
    if (!industryModal || !promoterAssignmentsData) return;
    const ids = new Set(
      promoterAssignmentsData
        .filter((a: any) => a.storeId === industryModal.storeId)
        .map((a: any) => a.industry.id),
    );
    setIndustryModalSelectedIds(ids);
  }, [industryModal?.storeId, industryModal?.promoterId, promoterAssignmentsData]);

  const saveStoreIndustriesMutation = useMutation({
    mutationFn: ({ promoterId, storeId, industryIds }: { promoterId: string; storeId: string; industryIds: string[] }) =>
      adminService.setPromoterStoreIndustries(promoterId, storeId, industryIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promoter-industry-assignments'] });
      setIndustryModal(null);
    },
  });

  const addMutation = useMutation({
    mutationFn: ({ promoterId, storeIds, supervisorId }: { promoterId: string; storeIds: string[]; supervisorId?: string | null }) =>
      supervisorService.addStoresToRoute(promoterId, storeIds, supervisorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-routes'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ promoterId, storeId }: { promoterId: string; storeId: string }) =>
      supervisorService.removeStoreFromRoute(promoterId, storeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-routes'] });
    },
  });

  const updateSupMutation = useMutation({
    mutationFn: ({ promoterId, storeId, supervisorId }: { promoterId: string; storeId: string; supervisorId: string | null }) =>
      supervisorService.updateRouteAssignmentSupervisor(promoterId, storeId, supervisorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-routes'] });
      setEditingSupervisor(null);
    },
  });

  const routes: RouteEntry[] = routesData?.routes || [];
  const allStores: Store[] = storesData?.stores || [];
  const promoters = promotersData?.promoters || [];
  const supervisors = supervisorsData?.supervisors || [];

  const filteredStores = allStores.filter((store) => {
    const matchesSearch = !storeSearch ||
      store.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
      store.address.toLowerCase().includes(storeSearch.toLowerCase());
    const matchesState = !stateFilter || store.state === stateFilter;
    return matchesSearch && matchesState;
  });

  const availableStates = [...new Set(allStores.map(s => s.state).filter(Boolean))] as string[];

  function handleBatchAdd() {
    if (selectedPromoters.length === 0 || selectedStores.length === 0) return;

    const supId = selectedSupervisor || null;
    Promise.all(
      selectedPromoters.map(promoterId =>
        addMutation.mutateAsync({ promoterId, storeIds: selectedStores, supervisorId: supId })
      )
    ).then(() => {
      setSelectedStores([]);
      setSelectedPromoters([]);
      queryClient.invalidateQueries({ queryKey: ['all-routes'] });
    });
  }

  function handleRemoveStore(promoterId: string, storeId: string) {
    removeMutation.mutate({ promoterId, storeId });
  }

  function togglePromoterSelect(id: string) {
    setSelectedPromoters(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  function toggleStoreSelect(id: string) {
    setSelectedStores(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }

  function selectAllFilteredStores() {
    const ids = filteredStores.map(s => s.id);
    setSelectedStores(prev => {
      const newSet = new Set([...prev, ...ids]);
      return Array.from(newSet);
    });
  }

  function clearStoreSelection() {
    setSelectedStores([]);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Atribuir Lojas a Promotores</h1>
        <p className="text-text-secondary text-sm mt-1">
          Gerencie quais lojas cada promotor visita e qual supervisor cuida de cada rota.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Coluna Esquerda: Atribuicao Rapida */}
        <div className="xl:col-span-2 space-y-4">
          {/* 1. Selecionar Promotores */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-text-primary">1. Promotores</h2>
                {selectedPromoters.length > 0 && (
                  <Badge variant="primary">{selectedPromoters.length} selecionado(s)</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {promoters.map((p: any) => {
                  const isSelected = selectedPromoters.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePromoterSelect(p.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left text-sm transition-colors ${
                        isSelected
                          ? 'bg-primary-600/20 border border-primary-600/50'
                          : 'bg-dark-backgroundSecondary border border-transparent hover:border-dark-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-primary-600 border-primary-600' : 'border-dark-border'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-text-primary font-medium truncate block">{p.name}</span>
                        <span className="text-text-tertiary text-xs">{p.state || ''}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 2. Supervisor (opcional) */}
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-text-primary">2. Supervisor da rota <span className="text-text-tertiary font-normal">(opcional)</span></h2>
            </CardHeader>
            <CardContent>
              <select
                value={selectedSupervisor}
                onChange={(e) => setSelectedSupervisor(e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-backgroundSecondary border border-dark-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              >
                <option value="">Nenhum (sem supervisor vinculado)</option>
                {supervisors.map((sup: any) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name} {sup.state ? `(${sup.state})` : ''}
                  </option>
                ))}
              </select>
              {selectedSupervisor && (
                <p className="text-xs text-primary-400 mt-2">
                  As lojas serao vinculadas a este supervisor na rota.
                </p>
              )}
            </CardContent>
          </Card>

          {/* 3. Selecionar Lojas */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-text-primary">3. Lojas para adicionar</h2>
                {selectedStores.length > 0 && (
                  <Badge variant="accent">{selectedStores.length} loja(s)</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Buscar loja..."
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  className="flex-1"
                />
                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="px-3 py-2 bg-dark-backgroundSecondary border border-dark-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                >
                  <option value="">UF</option>
                  {availableStates.sort().map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 mb-3">
                <button
                  onClick={selectAllFilteredStores}
                  className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                >
                  Selecionar todos ({filteredStores.length})
                </button>
                <span className="text-dark-border">|</span>
                <button
                  onClick={clearStoreSelection}
                  className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  Limpar
                </button>
              </div>

              <div className="space-y-1 max-h-60 overflow-y-auto">
                {filteredStores.map((store) => {
                  const isSelected = selectedStores.includes(store.id);
                  return (
                    <button
                      key={store.id}
                      onClick={() => toggleStoreSelect(store.id)}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left text-sm transition-colors ${
                        isSelected
                          ? 'bg-accent-500/15 border border-accent-500/40'
                          : 'bg-dark-backgroundSecondary border border-transparent hover:border-dark-border'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-accent-500 border-accent-500' : 'border-dark-border'
                      }`}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-text-primary truncate">{store.name}</span>
                          {store.state && (
                            <span className="text-xs text-text-tertiary bg-dark-card px-1.5 py-0.5 rounded shrink-0">
                              {store.state}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-text-tertiary truncate block">{store.address}</span>
                      </div>
                    </button>
                  );
                })}
                {filteredStores.length === 0 && (
                  <p className="text-center py-4 text-text-tertiary text-sm">Nenhuma loja encontrada</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Botao de Atribuir */}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleBatchAdd}
            disabled={selectedPromoters.length === 0 || selectedStores.length === 0 || addMutation.isPending}
            isLoading={addMutation.isPending}
          >
            Adicionar {selectedStores.length} loja(s) a {selectedPromoters.length} promotor(es)
            {selectedSupervisor ? ` (sup: ${supervisors.find((s: any) => s.id === selectedSupervisor)?.name || ''})` : ''}
          </Button>
        </div>

        {/* Coluna Direita: Visao Geral */}
        <div className="xl:col-span-3">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-text-primary">Atribuicoes Atuais</h2>
            </CardHeader>
            <CardContent>
              {loadingRoutes ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : routes.length === 0 ? (
                <p className="text-center py-8 text-text-tertiary">Nenhuma rota configurada ainda.</p>
              ) : (
                <div className="space-y-2">
                  {routes.map((route) => {
                    const isExpanded = expandedPromoter === route.promoter.id;

                    return (
                      <div key={route.promoter.id} className="border border-dark-border rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedPromoter(isExpanded ? null : route.promoter.id)}
                          className="w-full flex items-center justify-between p-3 hover:bg-dark-cardElevated transition-colors text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-primary-600/20 text-primary-400 flex items-center justify-center text-sm font-bold shrink-0">
                              {route.promoter.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-text-primary block truncate">
                                {route.promoter.name}
                              </span>
                              <span className="text-xs text-text-tertiary">{route.promoter.email}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={route.totalStores > 0 ? 'primary' : 'gray'}>
                              {route.totalStores} loja{route.totalStores !== 1 ? 's' : ''}
                            </Badge>
                            <svg
                              className={`w-4 h-4 text-text-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-dark-border bg-dark-backgroundSecondary/50 p-3">
                            {route.stores.length === 0 ? (
                              <p className="text-sm text-text-tertiary">Nenhuma loja atribuida.</p>
                            ) : (
                              <div className="space-y-2">
                                {route.stores.map((s) => {
                                  const isEditingSup = editingSupervisor?.promoterId === route.promoter.id && editingSupervisor?.storeId === s.store.id;

                                  return (
                                    <div
                                      key={s.store.id}
                                      className="flex items-center gap-2 bg-dark-card border border-dark-border rounded-lg px-3 py-2 group"
                                    >
                                      <span className="text-xs text-text-tertiary shrink-0">#{s.order + 1}</span>
                                      <span className="text-sm text-text-primary truncate">{s.store.name}</span>

                                      {/* Supervisor badge / editor */}
                                      <div className="ml-auto flex items-center gap-2 shrink-0">
                                        {isEditingSup ? (
                                          <select
                                            autoFocus
                                            defaultValue={s.supervisor?.id || ''}
                                            onChange={(e) => {
                                              updateSupMutation.mutate({
                                                promoterId: route.promoter.id,
                                                storeId: s.store.id,
                                                supervisorId: e.target.value || null,
                                              });
                                            }}
                                            onBlur={() => setEditingSupervisor(null)}
                                            className="px-2 py-1 text-xs bg-dark-backgroundSecondary border border-dark-border rounded text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-600"
                                          >
                                            <option value="">Sem supervisor</option>
                                            {supervisors.map((sup: any) => (
                                              <option key={sup.id} value={sup.id}>{sup.name}</option>
                                            ))}
                                          </select>
                                        ) : (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingSupervisor({ promoterId: route.promoter.id, storeId: s.store.id });
                                            }}
                                            className={`px-2 py-0.5 rounded text-xs transition-colors ${
                                              s.supervisor
                                                ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                                                : 'bg-dark-border/50 text-text-tertiary hover:bg-dark-border hover:text-text-secondary'
                                            }`}
                                            title="Clique para alterar supervisor"
                                          >
                                            {s.supervisor ? s.supervisor.name : 'sem sup.'}
                                          </button>
                                        )}

                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setIndustryModal({
                                              promoterId: route.promoter.id,
                                              promoterName: route.promoter.name,
                                              storeId: s.store.id,
                                              storeName: s.store.name,
                                            });
                                          }}
                                          className="px-2 py-0.5 rounded text-xs bg-primary-600/20 text-primary-400 hover:bg-primary-600/30 transition-colors"
                                          title="Indústrias que o promotor atende nesta loja"
                                        >
                                          Indústrias
                                        </button>

                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Remover "${s.store.name}" de ${route.promoter.name}?`)) {
                                              handleRemoveStore(route.promoter.id, s.store.id);
                                            }
                                          }}
                                          className="w-5 h-5 rounded-full flex items-center justify-center text-text-tertiary hover:text-red-400 hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100"
                                          title="Remover loja"
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Indústrias por promotor/loja */}
      {industryModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[85vh] flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary">
                  Indústrias · {industryModal.promoterName} / {industryModal.storeName}
                </h2>
                <button
                  onClick={() => setIndustryModal(null)}
                  className="text-text-tertiary hover:text-text-primary text-xl leading-none"
                >
                  ×
                </button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              <p className="text-sm text-text-secondary mb-3">
                Marque as indústrias que este promotor atende nesta loja.
              </p>
              {!storeIndustriesData?.industries?.length ? (
                <div className="py-6 text-center text-text-tertiary">Carregando...</div>
              ) : (
                <div className="space-y-2">
                  {(storeIndustriesData.industries || []).map((ind: any) => {
                    const isSelected = industryModalSelectedIds.has(ind.id);
                    return (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => {
                          setIndustryModalSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(ind.id)) next.delete(ind.id);
                            else next.add(ind.id);
                            return next;
                          });
                        }}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left text-sm border transition-colors ${
                          isSelected
                            ? 'bg-primary-600/20 border-primary-600/50'
                            : 'bg-dark-backgroundSecondary border-dark-border'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-primary-600 border-primary-600' : 'border-dark-border'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-text-primary truncate">{ind.name}</span>
                        <span className="text-xs text-text-tertiary shrink-0">({ind.code})</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2 mt-4 pt-4 border-t border-dark-border">
                <Button variant="outline" className="flex-1" onClick={() => setIndustryModal(null)}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => {
                    saveStoreIndustriesMutation.mutate({
                      promoterId: industryModal.promoterId,
                      storeId: industryModal.storeId,
                      industryIds: Array.from(industryModalSelectedIds),
                    });
                  }}
                  disabled={saveStoreIndustriesMutation.isPending}
                  isLoading={saveStoreIndustriesMutation.isPending}
                >
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
