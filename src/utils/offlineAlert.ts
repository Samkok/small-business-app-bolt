import { Alert, Platform } from 'react-native';
import { isNetworkError } from '../lib/network';

let isAlertVisible = false;
let lastAlertTime = 0;
const MIN_ALERT_INTERVAL = 2000;

export function showErrorAlert(title: string, message: string): void {
  const now = Date.now();
  if (isAlertVisible || now - lastAlertTime < MIN_ALERT_INTERVAL) return;

  isAlertVisible = true;
  lastAlertTime = now;

  Alert.alert(title, message, [
    {
      text: 'OK',
      onPress: () => { isAlertVisible = false; },
    },
  ]);
}

export function showNetworkAwareError(
  error: unknown,
  title: string,
  message: string,
  isConnected: boolean
): void {
  if (isNetworkError(error) && !isConnected) return;
  showErrorAlert(title, message);
}
