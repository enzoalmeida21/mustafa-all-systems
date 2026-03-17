import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiConfig from '../config/api';

const apiClient = axios.create({
  baseURL: apiConfig.BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export interface PresignedUrlRequest {
  visitId: string;
  type: 'FACADE_CHECKIN' | 'FACADE_CHECKOUT' | 'OTHER';
  contentType?: string;
  extension?: string;
}

export const photoService = {
  async getPresignedUrl(data: PresignedUrlRequest) {
    const response = await apiClient.post(apiConfig.ENDPOINTS.UPLOAD.PHOTO, data);
    return response.data;
  },

  /**
   * Faz upload de uma foto para Firebase Storage usando presigned URL
   * Compatível com React Native usando expo-file-system
   */
  async uploadToFirebase(presignedUrl: string, fileUri: string, contentType: string = 'image/jpeg'): Promise<boolean> {
    try {
      console.log('📤 [photoService] Iniciando upload para Firebase Storage...');
      console.log('📤 [photoService] Presigned URL:', presignedUrl.substring(0, 100) + '...');
      console.log('📤 [photoService] URI do arquivo:', fileUri);
      console.log('📤 [photoService] Content-Type:', contentType);

      // Verificar se o arquivo existe
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error('Arquivo não encontrado: ' + fileUri);
      }

      console.log('📤 [photoService] Arquivo encontrado, tamanho:', fileInfo.size, 'bytes');

      // Normalizar URI (garantir que tem file://)
      const normalizedUri = fileUri.startsWith('file://') ? fileUri : `file://${fileUri}`;

      // Fazer upload usando expo-file-system
      console.log('📤 [photoService] Iniciando upload PUT para Firebase...');
      console.log('📤 [photoService] Presigned URL completa (primeiros 200 chars):', presignedUrl.substring(0, 200));
      
      const uploadResult = await FileSystem.uploadAsync(presignedUrl, normalizedUri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': contentType,
        },
      });

      console.log('📤 [photoService] Upload concluído - Status:', uploadResult.status);
      console.log('📤 [photoService] Resposta completa:', {
        status: uploadResult.status,
        body: uploadResult.body?.substring(0, 500) || '(vazio)',
        headers: uploadResult.headers,
      });
      
      // Log detalhado do erro se houver
      if (uploadResult.status !== 200 && uploadResult.status !== 201) {
        console.error('❌ [photoService] ===== DETALHES DO ERRO DE UPLOAD =====');
        console.error('❌ [photoService] Status HTTP:', uploadResult.status);
        console.error('❌ [photoService] Body completo:', uploadResult.body);
        console.error('❌ [photoService] Headers de resposta:', uploadResult.headers);
        console.error('❌ [photoService] Presigned URL usada:', presignedUrl);
        console.error('❌ [photoService] ======================================');
      }
      
      // Firebase Storage aceita 200 (OK) ou 201 (Created)
      if (uploadResult.status === 200 || uploadResult.status === 201) {
        console.log('✅ [photoService] Upload bem-sucedido! Status:', uploadResult.status);
        return true;
      } else {
        console.error('❌ [photoService] Upload falhou com status:', uploadResult.status);
        console.error('❌ [photoService] Resposta completa:', uploadResult.body);
        
        // Log detalhado do erro
        if (uploadResult.status === 403) {
          console.error('❌ [photoService] Erro 403: Acesso negado - Verifique as regras do Firebase Storage!');
        } else if (uploadResult.status === 404) {
          console.error('❌ [photoService] Erro 404: URL não encontrada - Verifique a presigned URL!');
        } else if (uploadResult.status >= 500) {
          console.error('❌ [photoService] Erro do servidor:', uploadResult.status);
        }
        
        return false;
      }
    } catch (error: any) {
      console.error('❌ [photoService] Erro no upload:', error);
      console.error('❌ [photoService] Tipo do erro:', error?.constructor?.name);
      console.error('❌ [photoService] Mensagem:', error?.message);
      console.error('❌ [photoService] Stack:', error?.stack);
      
      // Erros comuns e suas soluções
      if (error?.message?.includes('Network request failed')) {
        console.error('❌ [photoService] Erro de rede - Verifique conexão com internet');
      } else if (error?.message?.includes('403')) {
        console.error('❌ [photoService] Erro 403 - Verifique as regras do Firebase Storage!');
      }
      
      throw error;
    }
  },
};

