import React from 'react';

type NavigationContainerComponent = typeof import('@react-navigation/native')['NavigationContainer'];
type StatusBarComponent = typeof import('expo-status-bar')['StatusBar'];
type AuthProviderComponent = typeof import('./src/context/AuthContext')['AuthProvider'];
type UseAuthHook = typeof import('./src/context/AuthContext')['useAuth'];
type NavigatorComponent = React.ComponentType<any>;
type LoadingScreenComponent = React.ComponentType<any>;

console.log('App.tsx - Iniciando imports...');

let offlineSyncSetup: (() => () => void) | undefined;
try {
  const syncModule = require('./src/services/offlineSyncService');
  offlineSyncSetup = syncModule.offlineSyncService?.setupAutoSync?.bind(syncModule.offlineSyncService);
} catch (error) {
  console.warn('offlineSyncService não disponível:', error);
}

let NavigationContainer: NavigationContainerComponent | undefined;
let StatusBar: StatusBarComponent | undefined;
let AuthProvider: AuthProviderComponent | undefined;
let useAuth: UseAuthHook | undefined;
let AuthNavigator: NavigatorComponent | undefined;
let MainNavigator: NavigatorComponent | undefined;
let LoadingScreen: LoadingScreenComponent | undefined;

try {
  console.log('📦 Importando NavigationContainer...');
  NavigationContainer = require('@react-navigation/native').NavigationContainer;
  console.log('✅ NavigationContainer importado');
} catch (error) {
  console.error('❌ Erro ao importar NavigationContainer:', error);
}

try {
  console.log('📦 Importando StatusBar...');
  StatusBar = require('expo-status-bar').StatusBar;
  console.log('✅ StatusBar importado');
} catch (error) {
  console.error('❌ Erro ao importar StatusBar:', error);
}

try {
  console.log('📦 Importando AuthContext...');
  const AuthContext = require('./src/context/AuthContext');
  AuthProvider = AuthContext.AuthProvider;
  useAuth = AuthContext.useAuth;
  console.log('✅ AuthContext importado');
} catch (error) {
  console.error('❌ Erro ao importar AuthContext:', error);
  throw error; // Este é crítico, não pode continuar sem
}

try {
  console.log('📦 Importando AuthNavigator...');
  AuthNavigator = require('./src/navigation/AuthNavigator').default;
  console.log('✅ AuthNavigator importado');
} catch (error) {
  console.error('❌ Erro ao importar AuthNavigator:', error);
  throw error;
}

try {
  console.log('📦 Importando MainNavigator...');
  MainNavigator = require('./src/navigation/MainNavigator').default;
  console.log('✅ MainNavigator importado');
} catch (error: any) {
  const errorMsg = error?.message || error?.toString() || 'Erro desconhecido';
  
  // Ignorar erros de permissão (não são críticos, apenas avisos do Android)
  if (errorMsg.includes('DETECT_SCREEN_CAPTURE') || 
      errorMsg.includes('NativeUnimoduleProxy') ||
      errorMsg.includes('registerScreenCaptureObserver')) {
    console.warn('⚠️ Aviso de permissão ignorado ao importar MainNavigator:', errorMsg);
    // Tentar novamente após ignorar o erro
    try {
      MainNavigator = require('./src/navigation/MainNavigator').default;
      console.log('✅ MainNavigator importado após retry');
    } catch (retryError) {
      console.error('❌ Erro ao importar MainNavigator após retry:', retryError);
      // Não lançar erro, deixar MainNavigator como undefined e tratar no AppNavigator
    }
  } else {
    console.error('❌ Erro ao importar MainNavigator:', error);
    // Não lançar erro, deixar MainNavigator como undefined e tratar no AppNavigator
  }
}

try {
  console.log('📦 Importando LoadingScreen...');
  LoadingScreen = require('./src/components/LoadingScreen').default;
  console.log('✅ LoadingScreen importado');
} catch (error) {
  console.error('❌ Erro ao importar LoadingScreen:', error);
  throw error;
}

console.log('✅ Todos os imports concluídos');

function AppNavigator() {
  // Sempre chamar useAuth primeiro, antes de qualquer condicional
  // Isso garante que os hooks sejam sempre chamados na mesma ordem
  const authResult = useAuth && useAuth();
  const user = authResult?.user ?? null;
  const loading = authResult?.loading ?? false;

  if (!useAuth || !LoadingScreen || !NavigationContainer || !AuthNavigator) {
    console.error('❌ Dependências críticas de navegação não foram carregadas corretamente');
    const { View, Text } = require('react-native');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, color: '#f00', marginBottom: 10 }}>Erro ao carregar navegação</Text>
        <Text style={{ fontSize: 14, color: '#666' }}>Algumas dependências não foram carregadas. Reinicie o app.</Text>
      </View>
    );
  }

  if (loading) {
    return <LoadingScreen />;
  }

  // Sempre renderizar NavigationContainer para manter consistência dos hooks
  // Renderizar o navigator apropriado dentro dele
  return (
    <NavigationContainer navigationInChildEnabled>
      {user && MainNavigator ? (
        <MainNavigator />
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

export default function App() {
  const { useEffect: useEffectHook } = require('react');

  useEffectHook(() => {
    let unsubscribe: (() => void) | undefined;
    if (offlineSyncSetup) {
      try {
        unsubscribe = offlineSyncSetup();
      } catch {}
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);
  
  if (!AuthProvider || !StatusBar) {
    return null;
  }

  try {
    return (
      <AuthProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </AuthProvider>
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const { View, Text } = require('react-native');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, color: '#f00', marginBottom: 10 }}>Erro ao carregar o app</Text>
        <Text style={{ fontSize: 14, color: '#666' }}>{errorMessage}</Text>
      </View>
    );
  }
}
