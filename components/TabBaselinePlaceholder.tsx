/**
 * Minimal tab content for isolation testing only.
 * No Screen/KeyboardScreen, no providers, no scroll. Use so the tab bar is the only variable.
 * To use: temporarily in app/(tabs)/index.tsx return <TabBaselinePlaceholder /> instead of real Home.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function TabBaselinePlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Tab baseline — tap tab bar to test</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  text: {
    fontSize: 16,
    color: '#333',
  },
});
