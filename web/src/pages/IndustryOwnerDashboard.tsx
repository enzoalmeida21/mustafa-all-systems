import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { visitDataService, VisitPhoto, VisitFilters } from '../services/visitDataService';
import { industryService, Industry } from '../services/industryService';
import Card, { CardHeader, CardContent } from '../components/ui/Card';

interface Filters {
  storeId: string;
  month: string;
}

export default function IndustryOwnerDashboard() {
  const { user } = useAuth();
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [selectedIndustryId, setSelectedIndustryId] = useState<string>('');
  const [photos, setPhotos] = useState<VisitPhoto[]>([]);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [filters, setFilters] = useState<Filters>({ storeId: '', month: '' });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadIndustries();
  }, []);

  useEffect(() => {
    if (selectedIndustryId) {
      loadPhotos();
    }
  }, [selectedIndustryId, filters, page]);

  async function loadIndustries() {
    try {
      const list = await industryService.listIndustries(true);
      setIndustries(list);
      if (list.length > 0) {
        setSelectedIndustryId(list[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar indústrias:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPhotos() {
    if (!selectedIndustryId) return;
    setLoading(true);
    try {
      const result = await visitDataService.getIndustryPhotos(
        selectedIndustryId,
        {
          storeId: filters.storeId || undefined,
          month: filters.month || undefined,
        },
        page,
        50
      );
      setPhotos(result.photos);
      setTotalPhotos(result.total);
    } catch (error) {
      console.error('Erro ao carregar fotos:', error);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }

  const selectedIndustry = industries.find((i) => i.id === selectedIndustryId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Dashboard - Dono de Industria
        </h1>
        <p className="text-gray-400 mt-1">
          Visualize as fotos e dados das suas industrias nas lojas atendidas
        </p>
      </div>

      {/* Industry Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {industries.map((industry) => (
          <button
            key={industry.id}
            onClick={() => {
              setSelectedIndustryId(industry.id);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedIndustryId === industry.id
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {industry.name} ({industry.code})
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm text-gray-400 mb-1">Loja</label>
              <input
                type="text"
                placeholder="Filtrar por loja..."
                value={filters.storeId}
                onChange={(e) => setFilters((f) => ({ ...f, storeId: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div className="min-w-[160px]">
              <label className="block text-sm text-gray-400 mb-1">Mes (MM/YYYY)</label>
              <input
                type="text"
                placeholder="03/2026"
                value={filters.month}
                onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Industry Info */}
      {selectedIndustry && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold text-white">{selectedIndustry.name}</h2>
            <span className="text-sm text-gray-400">Codigo: {selectedIndustry.code}</span>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-purple-400">{totalPhotos}</p>
                <p className="text-sm text-gray-400">Total de Fotos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photo Gallery */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold text-white">Fotos</h2>
          <span className="text-sm text-gray-400">{totalPhotos} registros</span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Carregando...</p>
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Nenhuma foto encontrada com os filtros selecionados</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative group rounded-lg overflow-hidden border border-gray-700"
                  >
                    <img
                      src={photo.url}
                      alt={`Foto ${photo.industryName || ''}`}
                      className="w-full h-40 object-cover"
                      loading="lazy"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-xs text-white truncate">{photo.industryName || 'Sem industria'}</p>
                      <p className="text-xs text-gray-300">
                        {new Date(photo.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPhotos > 50 && (
                <div className="flex justify-center gap-2 mt-6">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 bg-gray-800 text-gray-300 rounded disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <span className="px-3 py-1 text-gray-400">
                    Pagina {page} de {Math.ceil(totalPhotos / 50)}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * 50 >= totalPhotos}
                    className="px-3 py-1 bg-gray-800 text-gray-300 rounded disabled:opacity-50"
                  >
                    Proxima
                  </button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
