import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { visitService } from '../services/visitService';
import { useVisitFlow } from '../features/visits';
import { offlineSyncService } from '../services/offlineSyncService';
import { colors, theme } from '../styles/theme';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

type HomeNavigation = NavigationProp<Record<string, object | undefined>>;

interface DailySummary {
  totalVisits: number;
  totalHours: number;
  completedVisits: number;
  inProgressVisits: number;
  totalPhotos: number;
  photoGoal: number;
  photoCompliance: number;
  status: 'conforme' | 'atencao' | 'fora_meta';
}

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const { visit: localVisit, isActiveVisit, pendingPhotosCount, pendingSurveysCount, clearVisit } = useVisitFlow();
  const [hasActiveVisit, setHasActiveVisit] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    checkActiveVisit();
    loadDailySummary();
    offlineSyncService.syncAll().catch(() => {});
    
    const unsubscribe = navigation.addListener('focus', () => {
      checkActiveVisit();
      loadDailySummary();
      offlineSyncService.syncAll().catch(() => {});
    });
    
    return unsubscribe;
  }, [navigation]);

  async function checkActiveVisit() {
    try {
      setLoading(true);
      const response = await visitService.getCurrentVisit();
      if (response.visit) {
        setHasActiveVisit(true);
      } else {
        setHasActiveVisit(false);
        try {
          await clearVisit();
        } catch (_) {}
      }
    } catch (error: any) {
      if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network Error')) {
        setHasActiveVisit(isActiveVisit);
      } else {
        console.warn('[HomeScreen] Erro ao verificar visita ativa:', error?.message || error);
        setHasActiveVisit(false);
        try {
          await clearVisit();
        } catch (_) {}
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadDailySummary() {
    try {
      setSummaryLoading(true);
      const summary = await visitService.getDailySummary();
      setDailySummary(summary);
    } catch (error: any) {
      console.warn('⚠️ Erro ao carregar resumo do dia:', error?.message || error);
      // Não definir erro crítico, apenas não mostrar resumo
      setDailySummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }

  function handleStartVisit() {
    navigation.navigate('Stores');
  }

  function handleContinueVisit() {
    navigation.navigate('ActiveVisit');
  }

  if (loading || hasActiveVisit === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Olá! 👋</Text>
        <Text style={styles.title}>Bem-vindo ao Promo Gestão</Text>
      </View>

      {/* Status Card */}
      <Card style={styles.statusCard} variant={hasActiveVisit ? 'primary' : 'default'} shadow>
        <View style={styles.statusContent}>
          <View
            style={[
              styles.statusIcon,
              hasActiveVisit ? styles.statusIconActive : undefined,
            ]}
          >
            <Text style={styles.statusIconText}>
              {hasActiveVisit ? '📍' : '✨'}
            </Text>
          </View>
          <View style={styles.statusText}>
            <Text style={styles.statusTitle}>
              {hasActiveVisit ? 'Visita em Andamento' : 'Nenhuma Visita Ativa'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {hasActiveVisit
                ? 'Continue sua visita atual ou finalize para iniciar uma nova'
                : 'Inicie uma nova visita para começar a trabalhar'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Action Button - só mostra Continuar se o backend confirmar visita ativa */}
      <View style={styles.actionContainer}>
        {hasActiveVisit === true ? (
          <>
            {localVisit && (
              <Card style={styles.activeVisitInfo} shadow>
                <Text style={styles.activeVisitStoreName}>{localVisit.storeName}</Text>
                <Text style={styles.activeVisitStatus}>
                  {localVisit.status === 'checkedIn' || localVisit.status === 'working'
                    ? 'Trabalhando na loja'
                    : localVisit.status === 'storeCompleted'
                    ? 'Loja concluída - faça checkout'
                    : 'Visita em andamento'}
                </Text>
                {(pendingPhotosCount > 0 || pendingSurveysCount > 0) && (
                  <Text style={styles.pendingSyncText}>
                    {pendingPhotosCount} foto(s) e {pendingSurveysCount} pesquisa(s) pendentes de sync
                  </Text>
                )}
              </Card>
            )}
            <Button
              variant="accent"
              size="lg"
              onPress={handleContinueVisit}
              style={styles.actionButton}
            >
              Continuar Visita
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onPress={handleStartVisit}
            style={styles.actionButton}
          >
            Iniciar Nova Visita
          </Button>
        )}
      </View>

      {/* Daily Summary Card */}
      {!summaryLoading && dailySummary && (
        <Card style={styles.summaryCard} shadow>
          <Text style={styles.summaryTitle}>Resumo do Dia</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{dailySummary.totalVisits}</Text>
              <Text style={styles.summaryLabel}>Visitas</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{dailySummary.totalHours.toFixed(1)}h</Text>
              <Text style={styles.summaryLabel}>Horas</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{dailySummary.totalPhotos}</Text>
              <Text style={styles.summaryLabel}>Fotos</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, styles.summaryCompliance]}>
                {dailySummary.photoCompliance.toFixed(0)}%
              </Text>
              <Text style={styles.summaryLabel}>Meta</Text>
            </View>
          </View>
          {dailySummary.inProgressVisits > 0 && (
            <View style={styles.inProgressBadge}>
              <Text style={styles.inProgressText}>
                {dailySummary.inProgressVisits} visita(s) em andamento
              </Text>
            </View>
          )}
        </Card>
      )}

      {summaryLoading && (
        <Card style={styles.summaryCard} shadow>
          <ActivityIndicator size="small" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Carregando resumo...</Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  contentContainer: {
    padding: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  greeting: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.normal,
    color: colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  title: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statusCard: {
    marginBottom: theme.spacing.xl,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: 60,
    height: 60,
    borderRadius: theme.borderRadius.full,
    backgroundColor: colors.dark.cardElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  statusIconActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderColor: colors.primary[600],
    ...theme.shadows.primary,
  },
  statusIconText: {
    fontSize: 28,
  },
  statusText: {
    flex: 1,
  },
  statusTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  statusSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  actionContainer: {
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  actionButton: {
    width: '100%',
  },
  activeVisitInfo: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  activeVisitStoreName: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  activeVisitStatus: {
    fontSize: theme.typography.fontSize.sm,
    color: colors.primary[400],
    fontWeight: theme.typography.fontWeight.medium,
  },
  pendingSyncText: {
    fontSize: theme.typography.fontSize.xs,
    color: colors.warning || '#f59e0b',
    marginTop: theme.spacing.xs,
    fontWeight: theme.typography.fontWeight.medium,
  },
  summaryCard: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  summaryTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  summaryItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: colors.dark.cardElevated,
    borderRadius: theme.borderRadius.lg,
  },
  summaryValue: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: colors.primary[400],
    marginBottom: theme.spacing.xs,
  },
  summaryCompliance: {
    color: colors.primary[500],
  },
  summaryLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  inProgressBadge: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: colors.primary[600] + '20',
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  inProgressText: {
    fontSize: theme.typography.fontSize.sm,
    color: colors.primary[400],
    fontWeight: theme.typography.fontWeight.medium,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.base,
    color: colors.text.secondary,
  },
});

