import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supervisorService } from '../services/supervisorService';
import { adminService } from '../services/adminService';
import Card, { CardContent, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';

interface RouteStoreEntry {
  store: { id: string; name: string; address?: string };
}

interface RouteEntry {
  promoter: { id: string; name: string; email: string };
  stores: RouteStoreEntry[];
}

interface StoreRow {
  id: string;
  name: string;
  address?: string;
  state?: string | null;
}

export default function PromoterOpsSupport() {
  const [promoterId, setPromoterId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [storeSearch, setStoreSearch] = useState('');

  const { data: promotersData, isLoading: loadingPromoters } = useQuery({
    queryKey: ['promoters'],
    queryFn: () => supervisorService.getPromoters(),
  });

  const { data: routesData, isLoading: loadingRoutes } = useQuery({
    queryKey: ['all-routes'],
    queryFn: () => supervisorService.getAllRoutes(),
  });

  const { data: storesData, isLoading: loadingStores } = useQuery({
    queryKey: ['available-stores'],
    queryFn: () => supervisorService.getAvailableStores(),
  });

  const promoters: { id: string; name: string; email: string }[] = promotersData?.promoters || [];
  const routes: RouteEntry[] = routesData?.routes || [];
  const allStores: StoreRow[] = storesData?.stores || [];

  const routeStores = useMemo(() => {
    if (!promoterId) return [];
    const entry = routes.find((r) => r.promoter.id === promoterId);
    return entry?.stores.map((s) => s.store) || [];
  }, [promoterId, routes]);

  const filteredGlobalStores = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return allStores.slice(0, 80);
    return allStores.filter((s) => {
      const name = (s.name || '').toLowerCase();
      const addr = (s.address || '').toLowerCase();
      const st = (s.state || '').toLowerCase();
      return name.includes(q) || addr.includes(q) || st.includes(q);
    }).slice(0, 120);
  }, [allStores, storeSearch]);

  const redoMutation = useMutation({
    mutationFn: ({ pid, sid }: { pid: string; sid: string }) =>
      adminService.createPromoterStoreRedoGrant(pid, sid),
  });

  const selectedPromoterName = promoters.find((p) => p.id === promoterId)?.name;
  const selectedStoreName =
    routeStores.find((s) => s.id === storeId)?.name || allStores.find((s) => s.id === storeId)?.name;

  const handleGrant = () => {
    if (!promoterId || !storeId) return;
    if (
      !confirm(
        `Permitir que ${selectedPromoterName || 'o promotor'} faça uma nova visita em "${selectedStoreName || 'esta loja'}" hoje (mesmo já tendo finalizado uma visita no dia)?`,
      )
    ) {
      return;
    }
    redoMutation.mutate(
      { pid: promoterId, sid: storeId },
      {
        onSuccess: (data) => {
          alert(data?.message || 'Concessão criada.');
        },
        onError: () => {
          alert('Não foi possível criar a concessão.');
        },
      },
    );
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Correções promotor</h1>
        <p className="text-sm text-text-secondary mt-2 leading-relaxed">
          Use esta tela quando o promotor se atrapalhar e precisar <strong>refazer a mesma loja no mesmo dia</strong>.
          Cada concessão permite <strong>um</strong> novo check-in naquela loja após já ter feito checkout hoje; no app a
          loja volta a aparecer como disponível e a concessão é <strong>consumida no próximo check-in</strong>.
        </p>
      </div>

      <Card className="border-dark-border">
        <CardHeader>
          <h2 className="text-lg font-semibold text-text-primary">1. Promotor</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingPromoters ? (
            <p className="text-sm text-text-tertiary">Carregando promotores...</p>
          ) : (
            <div>
              <label className="block text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1.5">
                Selecione o promotor
              </label>
              <select
                value={promoterId}
                onChange={(e) => {
                  setPromoterId(e.target.value);
                  setStoreId('');
                }}
                className="w-full max-w-md px-3 py-2 rounded-lg border border-dark-border bg-dark-card text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-600"
              >
                <option value="">— Escolher —</option>
                {promoters.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.email})
                  </option>
                ))}
              </select>
            </div>
          )}
          {!promoterId && !loadingPromoters && (
            <p className="text-sm text-text-tertiary">Selecione um promotor para escolher a loja.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-dark-border">
        <CardHeader>
          <h2 className="text-lg font-semibold text-text-primary">2. Loja</h2>
        </CardHeader>
        <CardContent className="space-y-6">
          {!promoterId ? null : loadingRoutes ? (
            <p className="text-sm text-text-tertiary">Carregando rota...</p>
          ) : (
            <>
              <div>
                <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                  Lojas na rota (prioridade)
                </h3>
                {routeStores.length === 0 ? (
                  <p className="text-sm text-text-tertiary">
                    Nenhuma loja na rota deste promotor — use a busca abaixo em todas as lojas.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {routeStores.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setStoreId(s.id)}
                        className={`px-3 py-2 rounded-lg text-sm text-left border transition-colors max-w-full ${
                          storeId === s.id
                            ? 'border-primary-500 bg-primary-600/15 text-primary-300'
                            : 'border-dark-border bg-dark-card text-text-secondary hover:border-primary-500/40'
                        }`}
                      >
                        <span className="font-medium line-clamp-2">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                  Todas as lojas (busca)
                </h3>
                <Input
                  placeholder="Nome, endereço ou UF..."
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  className="max-w-md mb-3"
                />
                {loadingStores ? (
                  <p className="text-sm text-text-tertiary">Carregando lojas...</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-dark-border divide-y divide-dark-border">
                    {filteredGlobalStores.length === 0 ? (
                      <p className="p-3 text-sm text-text-tertiary">Nenhuma loja encontrada.</p>
                    ) : (
                      filteredGlobalStores.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setStoreId(s.id)}
                          className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                            storeId === s.id ? 'bg-primary-600/15 text-primary-300' : 'hover:bg-dark-card text-text-secondary'
                          }`}
                        >
                          <div className="font-medium text-text-primary">{s.name}</div>
                          {(s.address || s.state) && (
                            <div className="text-xs text-text-tertiary truncate">
                              {[s.address, s.state].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
                {!storeSearch.trim() && allStores.length > 80 && (
                  <p className="text-xs text-text-tertiary mt-2">Mostrando as primeiras 80 lojas — use a busca para filtrar.</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-dark-border">
        <CardHeader>
          <h2 className="text-lg font-semibold text-text-primary">3. Confirmar</h2>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 text-sm text-text-secondary">
            {promoterId && storeId ? (
              <span>
                Conceder refazer hoje:{' '}
                <Badge variant="accent">{selectedPromoterName}</Badge>
                <span className="mx-1">em</span>
                <Badge variant="primary">{selectedStoreName || storeId}</Badge>
              </span>
            ) : (
              <span>Escolha promotor e loja para habilitar o botão.</span>
            )}
          </div>
          <Button
            variant="accent"
            onClick={handleGrant}
            disabled={!promoterId || !storeId || redoMutation.isPending}
            isLoading={redoMutation.isPending}
          >
            Permitir refazer visita hoje
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
