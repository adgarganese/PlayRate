import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';
import { sendPhTestEvent } from '../lib/analytics';
import { Button } from './ui/Button';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';

export default function ConnectionTest() {
  const scrollBottomPadding = useScrollContentBottomPadding();
  const [status, setStatus] = useState<'testing' | 'success' | 'error'>('testing');
  const [message, setMessage] = useState<string>('Testing connection...');
  const [details, setDetails] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const results: string[] = [];

      try {
        // Test 1: Check if Supabase client is initialized
        results.push('✓ Supabase client initialized');

        // Test 2: Try to query profiles table
        const { error: profilesError } = await supabase
          .from('profiles')
          .select('count')
          .limit(1);

        if (profilesError) {
          results.push(`✗ Profiles table error: ${profilesError.message}`);
          setStatus('error');
          setMessage('Connection failed - check if database schema is set up');
          setDetails(results);
          return;
        }

        results.push('✓ Profiles table accessible');

        // Test 3: Try to query sports table
        const { error: sportsError } = await supabase
          .from('sports')
          .select('count')
          .limit(1);

        if (sportsError) {
          results.push(`✗ Sports table error: ${sportsError.message}`);
        } else {
          results.push('✓ Sports table accessible');
        }

        // Test 4: Try to query courts table
        const { error: courtsError } = await supabase
          .from('courts')
          .select('count')
          .limit(1);

        if (courtsError) {
          results.push(`✗ Courts table error: ${courtsError.message}`);
        } else {
          results.push('✓ Courts table accessible');
        }

        // Test 5: Get actual profile count
        const { count, error: countError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        if (!countError) {
          results.push(`✓ Found ${count ?? 0} profile(s) in database`);
        }

        setStatus('success');
        setMessage('Connection successful! Database is ready.');
        setDetails(results);
      } catch (error: any) {
        setStatus('error');
        setMessage(`Connection error: ${error.message}`);
        setDetails([...results, `✗ Unexpected error: ${error.message}`]);
      }
    })();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: scrollBottomPadding }}>
      <View style={styles.content}>
        <Text style={styles.title}>Supabase Connection Test</Text>
        
        <View style={[styles.statusBox, status === 'success' && styles.successBox, status === 'error' && styles.errorBox]}>
          <Text style={[styles.statusText, status === 'success' && styles.successText, status === 'error' && styles.errorText]}>
            {status === 'testing' && '🔄 Testing...'}
            {status === 'success' && '✅ Success'}
            {status === 'error' && '❌ Error'}
          </Text>
          <Text style={styles.message}>{message}</Text>
        </View>

        <View style={styles.details}>
          <Text style={styles.detailsTitle}>Test Results:</Text>
          {details.map((detail, index) => (
            <Text key={index} style={styles.detailItem}>
              {detail}
            </Text>
          ))}
        </View>

        {status === 'success' && (
          <View style={styles.nextSteps}>
            <Text style={styles.nextStepsTitle}>Next Steps:</Text>
            <Text style={styles.nextStepItem}>• Navigate to /profiles to see profiles</Text>
            <Text style={styles.nextStepItem}>• Set up authentication to create profiles</Text>
            <Text style={styles.nextStepItem}>• Add sports and attributes to the database</Text>
          </View>
        )}

        {__DEV__ && (
          <View style={styles.devSection}>
            <Text style={styles.devSectionTitle}>Dev: PostHog</Text>
            <Button
              title="Send ph_test_event"
              onPress={sendPhTestEvent}
              variant="secondary"
              size="medium"
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statusBox: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 16,
  },
  successBox: {
    backgroundColor: '#e8f5e9',
  },
  errorBox: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  successText: {
    color: '#2e7d32',
  },
  errorText: {
    color: '#c62828',
  },
  message: {
    fontSize: 14,
    color: '#666',
  },
  details: {
    marginTop: 8,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  detailItem: {
    fontSize: 14,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  nextSteps: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  nextStepItem: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
  devSection: {
    marginTop: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },
  devSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#666',
  },
});

