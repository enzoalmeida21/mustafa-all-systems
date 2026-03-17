import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supervisorService } from '../services/supervisorService';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const BRAZILIAN_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

interface Industry {
  id: string;
  name: string;
  code: string;
}

const emptyForm = { name: '', code: '', address: '', state: '', industryIds: [] as string[] };

export default function StoresManagement() {
  const queryClient = useQueryClient();
  const nameRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { data: storesData, isLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: () => supervisorService.getAllStores(),
  });

  const { data: industriesData } = useQuery<Industry[]>({
    queryKey: ['industries'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const res = await axios.get(`${API_URL}/industries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data.industries || res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => supervisorService.createStore(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      const keepState = form.state;
      const keepIndustries = form.industryIds;
      setForm({ ...emptyForm, state: keepState, industryIds: keepIndustries });
      setSuccessMsg(`"${variables.name}" cadastrada!`);
      setTimeout(() => setSuccessMsg(''), 3000);
      nameRef.current?.focus();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      supervisorService.updateStore(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      cancelEdit();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => supervisorService.deleteStore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });

  const updateIndustriesMutation = useMutation({
    mutationFn: ({ storeId, industryIds }: { storeId: string; industryIds: string[] }) =>
      supervisorService.updateStoreIndustries(storeId, industryIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });

  const allStores = storesData?.stores || [];
  const industries: Industry[] = industriesData || [];

  const filteredStores = allStores.filter((store: any) => {
    const matchSearch = !searchTerm ||
      store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      store.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (store.code && store.code.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchState = !filterState || store.state === filterState;
    return matchSearch && matchState;
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.address) return;

    const data: any = {
      name: form.name,
      address: form.address,
    };
    if (form.code) data.code = form.code;
    if (form.state) data.state = form.state;
    if (form.industryIds.length > 0) data.industryIds = form.industryIds;

    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  }

  function startEdit(store: any) {
    setEditingId(store.id);
    setForm({
      name: store.name,
      code: store.code || '',
      address: store.address,
      state: store.state || '',
      industryIds: (store.storeIndustries || []).map((si: any) => si.industry.id),
    });
    nameRef.current?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    const keepState = form.state;
    const keepIndustries = form.industryIds;
    setForm({ ...emptyForm, state: keepState, industryIds: keepIndustries });
  }

  function handleDelete(id: string, name: string) {
    if (confirm(`Deletar loja "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  }

  function toggleIndustry(id: string) {
    setForm(prev => ({
      ...prev,
      industryIds: prev.industryIds.includes(id)
        ? prev.industryIds.filter(i => i !== id)
        : [...prev.industryIds, id],
    }));
  }

  function toggleStoreIndustry(storeId: string, industryId: string, currentIds: string[]) {
    const newIds = currentIds.includes(industryId)
      ? currentIds.filter(i => i !== industryId)
      : [...currentIds, industryId];
    updateIndustriesMutation.mutate({ storeId, industryIds: newIds });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Cadastro de Lojas</h1>
        <p className="text-text-secondary text-sm mt-1">
          Cadastre lojas rapidamente. Estado e indústrias são mantidos entre cadastros.
        </p>
      </div>

      {/* Formulário Rápido */}
      <Card className={editingId ? 'border-primary-600' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">
              {editingId ? 'Editando Loja' : 'Nova Loja'}
            </h2>
            {successMsg && (
              <span className="text-sm text-emerald-400 font-medium animate-fade-in">{successMsg}</span>
            )}
            {editingId && (
              <button onClick={cancelEdit} className="text-sm text-text-tertiary hover:text-text-primary">
                Cancelar edição
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <Input
                ref={nameRef}
                placeholder="Nome da Loja *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                placeholder="Código da Loja"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <Input
                placeholder="Endereço *"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
              />
              <select
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="px-4 py-2 bg-dark-backgroundSecondary border border-dark-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              >
                <option value="">UF</option>
                {BRAZILIAN_STATES.map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>

            {/* Indústrias */}
            {industries.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-text-secondary mb-2">Indústrias obrigatórias nesta loja:</p>
                <div className="flex flex-wrap gap-1.5">
                  {industries.map((ind) => {
                    const isSelected = form.industryIds.includes(ind.id);
                    return (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => toggleIndustry(ind.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-primary-600 text-white'
                            : 'bg-dark-backgroundSecondary text-text-secondary border border-dark-border hover:border-primary-600'
                        }`}
                      >
                        {ind.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="submit"
                variant="primary"
                isLoading={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? 'Salvar Alterações' : 'Cadastrar e Continuar'}
              </Button>
              {!editingId && form.industryIds.length > 0 && (
                <span className="text-xs text-text-tertiary self-center">
                  {form.industryIds.length} indústria(s) serão vinculadas
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Filtros e Tabela */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-text-primary">
              Lojas Cadastradas ({filteredStores.length})
            </h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 sm:w-48"
              />
              <select
                value={filterState}
                onChange={(e) => setFilterState(e.target.value)}
                className="px-3 py-2 bg-dark-backgroundSecondary border border-dark-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              >
                <option value="">Todos UF</option>
                {BRAZILIAN_STATES.map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredStores.length === 0 ? (
            <div className="text-center py-12 text-text-tertiary">
              {allStores.length === 0 ? 'Nenhuma loja cadastrada ainda.' : 'Nenhuma loja encontrada com esse filtro.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-border bg-dark-backgroundSecondary">
                    <th className="text-left py-2.5 px-4 text-text-secondary font-medium">Código</th>
                    <th className="text-left py-2.5 px-4 text-text-secondary font-medium">Nome</th>
                    <th className="text-left py-2.5 px-4 text-text-secondary font-medium">Endereço</th>
                    <th className="text-left py-2.5 px-4 text-text-secondary font-medium">UF</th>
                    <th className="text-left py-2.5 px-4 text-text-secondary font-medium">Indústrias</th>
                    <th className="text-right py-2.5 px-4 text-text-secondary font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStores.map((store: any) => {
                    const storeIndustryIds = (store.storeIndustries || []).map((si: any) => si.industry.id);
                    return (
                      <tr key={store.id} className="border-b border-dark-border hover:bg-dark-card transition-colors">
                        <td className="py-2.5 px-4 text-text-tertiary font-mono text-xs">
                          {store.code || '-'}
                        </td>
                        <td className="py-2.5 px-4 text-text-primary font-medium">{store.name}</td>
                        <td className="py-2.5 px-4 text-text-secondary max-w-xs truncate">{store.address}</td>
                        <td className="py-2.5 px-4">
                          {store.state ? (
                            <span className="text-xs bg-dark-backgroundSecondary text-text-secondary px-2 py-0.5 rounded">
                              {store.state}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {industries.map((ind) => {
                              const isActive = storeIndustryIds.includes(ind.id);
                              return (
                                <button
                                  key={ind.id}
                                  onClick={() => toggleStoreIndustry(store.id, ind.id, storeIndustryIds)}
                                  className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                                    isActive
                                      ? 'bg-primary-600/20 text-primary-400 border border-primary-600/40'
                                      : 'bg-dark-backgroundSecondary text-text-tertiary border border-transparent hover:border-dark-border'
                                  }`}
                                  title={isActive ? `Remover ${ind.name}` : `Adicionar ${ind.name}`}
                                >
                                  {ind.name}
                                </button>
                              );
                            })}
                            {industries.length === 0 && (
                              <span className="text-text-tertiary text-xs">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => startEdit(store)}
                              className="px-2 py-1 text-xs text-primary-400 hover:bg-primary-600/20 rounded transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(store.id, store.name)}
                              className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/20 rounded transition-colors"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
