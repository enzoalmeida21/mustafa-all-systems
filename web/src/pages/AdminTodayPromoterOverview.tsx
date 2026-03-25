import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../services/adminService';
import Card, { CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Link } from 'react-router-dom';

export default function AdminTodayPromoterOverview() {
  const [selectedState, setSelectedState] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'today-overview'],
    queryFn: () => adminService.getAdminTodayOverview(),
  });

  const states = data?.states || [];
  const promoters = data?.promoters || [];

  const activeState = selectedState || (states.length > 0 ? states[0].state : '');

  const filteredPromoters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return promoters
      .filter((p) => (activeState ? (p.state || '—') === activeState : true))
      .filter((p) => {
        if (!q) return true;
        return (
          (p.name || '').toLowerCase().includes(q) ||
          (p.email || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Priorizar alertas e visita aberta
        const aScore = (a.unjustifiedMissesToday > 0 ? 100 : 0) + (a.hasOpenVisit ? 10 : 0) + (a.noVisitToday ? 5 : 0);
        const bScore = (b.unjustifiedMissesToday > 0 ? 100 : 0) + (b.hasOpenVisit ? 10 : 0) + (b.noVisitToday ? 5 : 0);
        if (bScore !== aScore) return bScore - aScore;
        return a.name.localeCompare(b.name);
      });
  }, [promoters, activeState, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Situação de hoje (Promotores)</h1>
          <p className="text-sm text-text-secondary mt-1">
            Visão rápida por UF: visita aberta, sem visita hoje e alertas de falta sem justificativa.
          </p>
        </div>
        <Link to="/admin/promoter-correcoes">
          <Button variant="outline" size="sm">Correções promotor</Button>
        </Link>
      </div>

      {/* Cards por UF */}
      <div className="flex gap-3 overflow-x-auto scrollbar-dark pb-2">
        {states.map((st) => {
          const isActive = (st.state || '—') === activeState;
          return (
            <button
              key={st.state}
              type="button"
              onClick={() => setSelectedState(st.state)}
              className={`min-w-[220px] text-left rounded-xl border px-4 py-3 transition-colors ${
                isActive
                  ? 'border-primary-600 bg-primary-600/10'
                  : 'border-dark-border bg-dark-card hover:border-primary-500/40'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-text-primary">
                  {st.state || '—'}
                </div>
                {st.unjustifiedMisses > 0 ? (
                  <Badge variant="error">Alerta</Badge>
                ) : (
                  <Badge variant="success">OK</Badge>
                )}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-text-tertiary">
                <div>
                  <div className="text-text-secondary font-semibold">{st.promotersTotal}</div>
                  <div>Total</div>
                </div>
                <div>
                  <div className="text-text-secondary font-semibold">{st.openVisits}</div>
                  <div>Abertas</div>
                </div>
                <div>
                  <div className="text-text-secondary font-semibold">{st.noVisitToday}</div>
                  <div>Sem visita</div>
                </div>
              </div>
              {st.unjustifiedMisses > 0 && (
                <div className="mt-2 text-xs text-red-300">
                  {st.unjustifiedMisses} falta(s) sem justificativa
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Busca e lista */}
      <Card className="border-dark-border">
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="text-sm text-text-secondary">
              UF ativa: <span className="text-text-primary font-semibold">{activeState || '—'}</span>
            </div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar promotor (nome/email)..."
              className="sm:max-w-sm"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredPromoters.length === 0 ? (
            <div className="py-10 text-center text-text-tertiary text-sm">
              Nenhum promotor encontrado.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPromoters.map((p) => (
                <div key={p.id} className="rounded-xl border border-dark-border bg-dark-card px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-text-primary truncate">{p.name}</div>
                      <div className="text-xs text-text-tertiary truncate">{p.email}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {p.unjustifiedMissesToday > 0 && <Badge variant="error">Alerta</Badge>}
                      {p.hasOpenVisit ? <Badge variant="warning">Visita aberta</Badge> : <Badge variant="gray">Sem aberta</Badge>}
                      {p.noVisitToday && <Badge variant="gray">Sem visita hoje</Badge>}
                      <Badge variant="primary">{p.visitsToday} visita(s)</Badge>
                      <Link to={`/promoters/${p.id}`}>
                        <Button variant="ghost" size="sm">Detalhes</Button>
                      </Link>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-text-tertiary flex flex-wrap gap-x-4 gap-y-1">
                    <span>Última atividade: {p.lastActivityAt ? new Date(p.lastActivityAt).toLocaleTimeString('pt-BR') : '—'}</span>
                    {p.openVisit && (
                      <span>VisitID aberto: {p.openVisit.id.slice(0, 8)}…</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

