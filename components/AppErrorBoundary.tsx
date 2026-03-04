import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Sentry } from '@/lib/sentry';

type Props = {
  children: ReactNode;
  fallbackMessage?: string;
  onReset?: () => void;
  onSignOut?: () => void;
};

type State = {
  hasError: boolean;
  error: Error | null;
  retryKey: number;
};

/**
 * Catches JS errors in the tree so the app doesn't crash (e.g. on TestFlight after sign-in).
 * Reports to Sentry and shows a simple fallback with retry.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (Sentry?.captureException) {
      Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    }
    if (__DEV__) {
      console.error('[AppErrorBoundary]', error, errorInfo.componentStack);
    }
  }

  handleRetry = (): void => {
    this.props.onReset?.();
    // Force a full remount of children so the same error doesn't recur; short delay lets profile/session settle
    const nextKey = this.state.retryKey + 1;
    this.setState({ retryKey: nextKey });
    setTimeout(() => {
      this.setState({ hasError: false, error: null });
    }, 600);
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.props.fallbackMessage ?? 'We hit an error. Try again or restart the app.'}
          </Text>
          <Pressable onPress={this.handleRetry} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
          {this.props.onSignOut && (
            <Pressable onPress={this.props.onSignOut} style={({ pressed }) => [styles.buttonSecondary, pressed && styles.buttonPressed]}>
              <Text style={styles.buttonSecondaryText}>Sign out</Text>
            </Pressable>
          )}
        </View>
      );
    }
    return (
      <React.Fragment key={this.state.retryKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#0B1020',
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#64748b',
  },
  buttonSecondaryText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
});
