import { AlertContextInterface } from '../hooks/useAlert';
import { ErrorType } from './Fetch';

const catchError = (Alert: AlertContextInterface) => (error: ErrorType | string) => {
  const errorMessage = typeof error === 'string'
    ? error
    : error.message
      ? error.message.startsWith('<!DOCTYPE html>')
        ? error.statusText
        : error.message
      : error.statusText;
  Alert.open('error', errorMessage);
};

export default catchError;
