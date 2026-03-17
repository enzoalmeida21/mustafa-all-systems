import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { adminService, User, CreateUserRequest, UpdateUserRequest } from '../services/adminService';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';

const BRAZILIAN_STATES = [
  { uf: 'AC', name: 'Acre' }, { uf: 'AL', name: 'Alagoas' }, { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' }, { uf: 'BA', name: 'Bahia' }, { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' }, { uf: 'ES', name: 'Espírito Santo' }, { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' }, { uf: 'MT', name: 'Mato Grosso' }, { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' }, { uf: 'PA', name: 'Pará' }, { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' }, { uf: 'PE', name: 'Pernambuco' }, { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' }, { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' }, { uf: 'RO', name: 'Rondônia' }, { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' }, { uf: 'SP', name: 'São Paulo' }, { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
];

export default function Admin() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    state: '',
    role: 'PROMOTER' as 'PROMOTER' | 'SUPERVISOR' | 'ADMIN' | 'INDUSTRY_OWNER',
  });
  const [supervisorStates, setSupervisorStates] = useState<string[]>([]);
  const [promoterSupervisorIds, setPromoterSupervisorIds] = useState<string[]>([]);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminService.listUsers(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserRequest) => adminService.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
      adminService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setIsModalOpen(false);
      setEditingUser(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminService.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const regionsMutation = useMutation({
    mutationFn: ({ id, states }: { id: string; states: string[] }) =>
      adminService.setSupervisorRegions(id, states),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const promoterSupervisorsMutation = useMutation({
    mutationFn: ({ id, supervisorIds }: { id: string; supervisorIds: string[] }) =>
      adminService.setPromoterSupervisors(id, supervisorIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  function resetForm() {
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      state: '',
      role: 'PROMOTER',
    });
    setSupervisorStates([]);
    setPromoterSupervisorIds([]);
    setEditingUser(null);
  }

  function handleOpenModal(user?: User) {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: '',
        phone: user.phone || '',
        state: user.state || '',
        role: user.role,
      });
      if (user.role === 'SUPERVISOR') {
        adminService.getSupervisorRegions(user.id).then(setSupervisorStates).catch(() => {});
      }
      if (user.role === 'PROMOTER') {
        adminService.getPromoterSupervisors(user.id)
          .then(sups => setPromoterSupervisorIds(sups.map(s => s.id)))
          .catch(() => {});
      }
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    resetForm();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (editingUser) {
      const updateData: UpdateUserRequest = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        phone: formData.phone || undefined,
        state: formData.state || null,
      };
      if (formData.password) {
        updateData.password = formData.password;
      }
      updateMutation.mutate({ id: editingUser.id, data: updateData });
      if (formData.role === 'SUPERVISOR') {
        regionsMutation.mutate({ id: editingUser.id, states: supervisorStates });
      }
      if (formData.role === 'PROMOTER') {
        promoterSupervisorsMutation.mutate({ id: editingUser.id, supervisorIds: promoterSupervisorIds });
      }
    } else {
      if (!formData.password) {
        alert('A senha é obrigatória para criar um novo usuário');
        return;
      }
      const createData: any = { ...formData };
      if (!createData.state) delete createData.state;
      createMutation.mutate(createData as CreateUserRequest);
    }
  }

  function handleDelete(id: string) {
    if (id === currentUser?.id) {
      alert('Não é possível deletar seu próprio usuário');
      return;
    }

    if (confirm('Tem certeza que deseja deletar este usuário?')) {
      deleteMutation.mutate(id);
    }
  }

  function getRoleLabel(role: string) {
    switch (role) {
      case 'ADMIN': return 'Administrador';
      case 'SUPERVISOR': return 'Supervisor';
      case 'PROMOTER': return 'Promotor';
      case 'INDUSTRY_OWNER': return 'Dono Indústria';
      default: return role;
    }
  }

  function getRoleColor(role: string): 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'gray' {
    switch (role) {
      case 'ADMIN': return 'error';
      case 'SUPERVISOR': return 'warning';
      case 'PROMOTER': return 'primary';
      case 'INDUSTRY_OWNER': return 'accent';
      default: return 'gray';
    }
  }

  function toggleSupervisorState(uf: string) {
    setSupervisorStates(prev =>
      prev.includes(uf) ? prev.filter(s => s !== uf) : [...prev, uf]
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-secondary">Carregando usuários...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Administração</h1>
          <p className="text-text-secondary mt-1">Gerencie usuários e configurações do sistema</p>
        </div>
        <Button onClick={() => handleOpenModal()}>+ Criar Novo Usuário</Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-text-primary">Usuários</h2>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Nome</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Email</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Celular</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Estado</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Função</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Criado em</th>
                  <th className="text-right py-3 px-4 text-text-secondary font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user) => (
                  <tr key={user.id} className="border-b border-dark-border hover:bg-dark-card">
                    <td className="py-3 px-4 text-text-primary">{user.name}</td>
                    <td className="py-3 px-4 text-text-secondary">{user.email}</td>
                    <td className="py-3 px-4 text-text-secondary">{user.phone || '-'}</td>
                    <td className="py-3 px-4 text-text-secondary">{user.state || '-'}</td>
                    <td className="py-3 px-4">
                      <Badge variant={getRoleColor(user.role)}>{getRoleLabel(user.role)}</Badge>
                    </td>
                    <td className="py-3 px-4 text-text-tertiary">
                      {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenModal(user)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(user.id)}
                          disabled={user.id === currentUser?.id}
                        >
                          Deletar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users?.length === 0 && (
              <div className="text-center py-8 text-text-secondary">
                Nenhum usuário encontrado
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <h2 className="text-xl font-semibold text-text-primary">
                {editingUser ? 'Editar Usuário' : 'Criar Novo Usuário'}
              </h2>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Nome"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
                <Input
                  label="Celular"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
                <Input
                  label={editingUser ? 'Nova Senha (deixe em branco para manter)' : 'Senha'}
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                />
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Estado (UF)
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-backgroundSecondary border border-dark-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-600"
                  >
                    <option value="">Sem estado</option>
                    {BRAZILIAN_STATES.map(s => (
                      <option key={s.uf} value={s.uf}>{s.uf} - {s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Função
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      const role = e.target.value as typeof formData.role;
                      setFormData({ ...formData, role });
                      if (role !== 'SUPERVISOR') setSupervisorStates([]);
                      if (role !== 'PROMOTER') setPromoterSupervisorIds([]);
                    }}
                    className="w-full px-4 py-2 bg-dark-backgroundSecondary border border-dark-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-600"
                  >
                    <option value="PROMOTER">Promotor</option>
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="INDUSTRY_OWNER">Dono de Indústria</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>
                {formData.role === 'SUPERVISOR' && editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Estados sob supervisão
                    </label>
                    <div className="flex flex-wrap gap-2 p-3 bg-dark-backgroundSecondary border border-dark-border rounded-lg max-h-40 overflow-y-auto">
                      {BRAZILIAN_STATES.map(s => (
                        <button
                          key={s.uf}
                          type="button"
                          onClick={() => toggleSupervisorState(s.uf)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            supervisorStates.includes(s.uf)
                              ? 'bg-primary-600 text-white'
                              : 'bg-dark-border text-text-secondary hover:bg-dark-card'
                          }`}
                        >
                          {s.uf}
                        </button>
                      ))}
                    </div>
                    {supervisorStates.length > 0 && (
                      <p className="text-xs text-text-tertiary mt-1">
                        Selecionados: {supervisorStates.sort().join(', ')}
                      </p>
                    )}
                  </div>
                )}
                {formData.role === 'PROMOTER' && editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Supervisor(es) responsável(is)
                    </label>
                    <div className="flex flex-wrap gap-2 p-3 bg-dark-backgroundSecondary border border-dark-border rounded-lg max-h-40 overflow-y-auto">
                      {(users || []).filter(u => u.role === 'SUPERVISOR').map(sup => {
                        const isSelected = promoterSupervisorIds.includes(sup.id);
                        return (
                          <button
                            key={sup.id}
                            type="button"
                            onClick={() => setPromoterSupervisorIds(prev =>
                              isSelected ? prev.filter(id => id !== sup.id) : [...prev, sup.id]
                            )}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                              isSelected
                                ? 'bg-primary-600 text-white'
                                : 'bg-dark-border text-text-secondary hover:bg-dark-card'
                            }`}
                          >
                            {sup.name}
                          </button>
                        );
                      })}
                      {(users || []).filter(u => u.role === 'SUPERVISOR').length === 0 && (
                        <span className="text-xs text-text-tertiary">Nenhum supervisor cadastrado</span>
                      )}
                    </div>
                    {promoterSupervisorIds.length > 0 && (
                      <p className="text-xs text-text-tertiary mt-1">
                        {promoterSupervisorIds.length} supervisor(es) selecionado(s)
                      </p>
                    )}
                  </div>
                )}
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseModal}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={createMutation.isPending || updateMutation.isPending}
                    className="flex-1"
                  >
                    {editingUser ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

