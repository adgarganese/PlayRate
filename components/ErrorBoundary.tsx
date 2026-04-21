import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { hideSplashOnce } from '@/lib/splash-control';
import { logger } from '@/lib/logger';
import { track } from '@/lib/analytics';

type Props = {
  children: ReactNode;
  /** Shown when error.message is not used as the primary body copy */
  fallbackMessage?: string;
  onReset?: () => void;
  onSignOut?: () => void;
};

type State = {
  hasError: boolean;
  error: Error | null;
  resetKey: number;
};

/** Catches render errors in descendants. Logs and reports to Sentry (logger) + PostHog (`error_fatal`). */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    hideSplashOnce();
    const stack = errorInfo.componentStack ?? '';
    const component_stack_first_line =
      stack
        .split('\n')
        .map((s) => s.trim())
        .find((s) => s.length > 0) ?? 'unknown';
    track('error_fatal', {
      error_message: error.message,
      error_name: error.name,
      component_stack_first_line,
    });
    logger.error('React render error (ErrorBoundary)', {
      err: error,
      componentStack: errorInfo.componentStack,
    });
  }

  handleTryAgain = (): void => {
    this.props.onReset?.();
    this.setState((s) => ({
      hasError: false,
      error: null,
      resetKey: s.resetKey + 1,
    }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const message =
        this.props.fallbackMessage ??
        this.state.error?.message ??
        'We ran into a problem showing this screen. You can try again.';

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>{message}</Text>
          <Pressable
            onPress={this.handleTryAgain}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
          {this.props.onSignOut ? (
            <Pressable
              onPress={this.props.onSignOut}
              style={({ pressed }) => [styles.buttonSecondary, pressed && styles.buttonPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.buttonSecondaryText}>Sign out</Text>
            </Pressable>
          ) : null}
        </View>
      );
    }

    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#EEF1F5',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#0B1020',
  },
  body: {
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
