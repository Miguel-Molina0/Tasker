import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createApiClient, Tokens } from './api-client';
const hostUri=Constants.expoConfig?.hostUri;
const reportedHost=hostUri?.split(':')[0];
const nativeHost=Platform.OS==='android' && ['localhost','127.0.0.1'].includes(reportedHost || '') ? '10.0.2.2' : reportedHost;
const webHost=Platform.OS==='web' && typeof location!=='undefined' ? location.hostname : undefined;
export const API_URL=(process.env.EXPO_PUBLIC_API_URL || `http://${webHost || nativeHost || '127.0.0.1'}:8000/api/`).replace(/\/+$/,'')+'/';
const prefix='tasker-api-'+API_URL.replace(/[^a-zA-Z0-9.-]/g,'_');
export const api=createApiClient(API_URL,{
  async read() {
    if (Platform.OS==='web') {
      const raw=typeof sessionStorage!=='undefined' ? sessionStorage.getItem(prefix) : null;
      try { return raw ? JSON.parse(raw) as Tokens : null; } catch { return null; }
    }
    const [access,refresh]=await Promise.all([SecureStore.getItemAsync(prefix+'-access'),SecureStore.getItemAsync(prefix+'-refresh')]);
    return access && refresh ? {access,refresh} : null;
  },
  async write(value) {
    if (Platform.OS==='web') {
      if(typeof sessionStorage!=='undefined') {
        if(value) sessionStorage.setItem(prefix,JSON.stringify(value)); else sessionStorage.removeItem(prefix);
      }
    } else if (value) {
      await SecureStore.setItemAsync(prefix+'-access',value.access);
      await SecureStore.setItemAsync(prefix+'-refresh',value.refresh);
    } else {
      await SecureStore.deleteItemAsync(prefix+'-access');
      await SecureStore.deleteItemAsync(prefix+'-refresh');
    }
  },
});
