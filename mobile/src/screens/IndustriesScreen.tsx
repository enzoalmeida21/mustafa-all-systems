import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { storeService, Store } from '../services/storeService';
import { colors, theme } from '../styles/theme';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { ensureLocationPermission, getCurrentPosition } from '../utils/locationHelper';

type StoresNavigation = NavigationProp<Record<string, object | undefined>>;

export default function StoresScreen() {
  const navigation = useNavigation<StoresNavigation>();
  const [stores, setStores] = useState<Store[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [completedStoreIdsToday, setCompletedStoreIdsToday] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredStores(stores);
    } else {
      const filtered = stores.filter(
        (store) =>
          store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          store.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredStores(filtered);
    }
  }, [searchTerm, stores]);

  async function loadStores() {
    try {
      setLoading(true);
      const response = await storeService.getStores();
      setStores(response.stores);
      setFilteredStores(response.stores);
      setCompletedStoreIdsToday(response.completedStoreIdsToday || []);
    } catch (error) {
      console.error('Erro ao carregar lojas:', error);
      Alert.alert('Erro', 'Não foi possível carregar as lojas');
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckIn(store: Store) {
    if (completedStoreIdsToday.includes(store.id)) {
      Alert.alert('Loja já visitada', 'Você já realizou visita nesta loja hoje. Não é possível fazer nova visita no mesmo dia.');
      return;
    }
    try {
      setCheckingIn(store.id);

      // Solicitar permissão de localização usando o helper
      const hasPermission = await ensureLocationPermission();
      if (!hasPermission) {
        setCheckingIn(null);
        return;
      }

      // Obter localização atual
      const location = await getCurrentPosition();
      const { latitude, longitude } = location.coords;

      // Navegar para tela de check-in
      navigation.navigate('CheckIn', {
        store,
        location: { latitude, longitude },
      });
    } catch (error: any) {
      console.error('Erro ao fazer check-in:', error);
      Alert.alert('Erro', error?.message || 'Erro ao fazer check-in. Verifique se o app tem permissão de localização.');
    } finally {
      setCheckingIn(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Carregando lojas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Selecione uma Loja</Text>
        <Text style={styles.subtitle}>
          {filteredStores.length} loja{filteredStores.length !== 1 ? 's' : ''} disponível
          {filteredStores.length !== 1 ? 'eis' : ''}
        </Text>
      </View>

      {/* Busca */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar lojas..."
          placeholderTextColor={colors.gray[400]}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchTerm('')}
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Lista de Lojas */}
      <FlatList
        data={filteredStores}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => {
          const alreadyVisitedToday = completedStoreIdsToday.includes(item.id);
          return (
            <Card
              key={item.id}
              style={[
                styles.storeCard,
                { marginTop: index === 0 ? 0 : theme.spacing.md },
                alreadyVisitedToday && styles.storeCardDone,
              ]}
              shadow
            >
              <View style={styles.storeHeader}>
                <View style={[styles.storeIcon, alreadyVisitedToday && styles.storeIconDone]}>
                  <Text style={styles.storeIconText}>🏪</Text>
                </View>
                <View style={styles.storeInfo}>
                  <Text style={styles.storeName}>{item.name}</Text>
                  <Text style={styles.storeAddress}>{item.address}</Text>
                  {alreadyVisitedToday && (
                    <Text style={styles.alreadyVisitedLabel}>Já visitada hoje</Text>
                  )}
                </View>
              </View>
              <Button
                variant="primary"
                size="md"
                onPress={() => handleCheckIn(item)}
                isLoading={checkingIn === item.id}
                disabled={checkingIn !== null || alreadyVisitedToday}
                style={styles.checkInButton}
              >
                {alreadyVisitedToday ? 'Já visitada hoje' : 'Fazer Check-in'}
              </Button>
            </Card>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>
              {searchTerm ? 'Nenhuma loja encontrada' : 'Nenhuma loja disponível'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchTerm
                ? 'Tente buscar com outros termos'
                : 'As lojas atribuídas aparecerão aqui'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  header: {
    padding: theme.spacing.lg,
    backgroundColor: colors.dark.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  title: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: colors.text.secondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: colors.dark.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.dark.border,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    fontSize: theme.typography.fontSize.base,
    color: colors.text.primary,
    backgroundColor: colors.dark.card,
  },
  clearButton: {
    marginLeft: theme.spacing.sm,
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  clearButtonText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  listContent: {
    padding: theme.spacing.md,
  },
  storeCard: {
    marginBottom: theme.spacing.md,
  },
  storeCardDone: {
    opacity: 0.85,
    borderColor: colors.dark.borderLight,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  storeIcon: {
    width: 50,
    height: 50,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[600],
  },
  storeIconText: {
    fontSize: 24,
  },
  storeIconDone: {
    backgroundColor: colors.gray[700],
    borderColor: colors.dark.border,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  storeAddress: {
    fontSize: theme.typography.fontSize.sm,
    color: colors.text.secondary,
  },
  alreadyVisitedLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: colors.primary[400],
    marginTop: theme.spacing.xs,
    fontWeight: theme.typography.fontWeight.medium,
  },
  checkInButton: {
    width: '100%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing['2xl'],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  emptySubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.base,
    color: colors.text.secondary,
  },
});
