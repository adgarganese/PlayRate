import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, TextInput as RNTextInput, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { Screen } from '@/components/ui/Screen';
import { KeyboardScreen } from '@/components/ui/KeyboardScreen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/Card';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { AppText } from '@/components/ui/AppText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { isSportEnabled } from '@/constants/sport-definitions';
import { geocodeAddress } from '@/lib/geocoding';
import { devWarn } from '@/lib/logging';

type Sport = {
  id: string;
  name: string;
};

// Available amenities list
const AVAILABLE_AMENITIES = [
  'Water fountain',
  'Restrooms',
  'Benches',
  'Shaded area',
  'Parking lot',
  'Street parking',
  'Wi-Fi',
  'Vending machines',
  'First aid kit',
  'Charging stations',
];

export default function NewCourtScreen() {
  const router = useRouter();
  useAuth();
  const { colors } = useThemeColors();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [selectedSports, setSelectedSports] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState('');
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // New detailed fields
  const [indoor, setIndoor] = useState<boolean | null>(null);
  const [hoopCount, setHoopCount] = useState<string>('');
  const [courtType, setCourtType] = useState<string>('');
  const [surfaceType, setSurfaceType] = useState<string>('');
  const [hasLights, setHasLights] = useState<boolean | null>(null);
  const [cost, setCost] = useState<string>('');
  const [hours, setHours] = useState<string>('');
  const [parkingType, setParkingType] = useState<string>('');
  const [selectedAmenities, setSelectedAmenities] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    loadSports();
  }, []);

  const loadSports = async () => {
    try {
      const { data, error } = await supabase
        .from('sports')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        setError(error.message);
        return;
      }

      setSports((data || []).filter((s) => isSportEnabled(s.name)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sports');
    } finally {
      setLoading(false);
    }
  };

  const toggleSport = (sportId: string) => {
    const newSelected = new Set(selectedSports);
    if (newSelected.has(sportId)) {
      newSelected.delete(sportId);
    } else {
      newSelected.add(sportId);
    }
    setSelectedSports(newSelected);
  };

  const toggleAmenity = (amenity: string) => {
    const newSelected = new Set(selectedAmenities);
    if (newSelected.has(amenity)) {
      newSelected.delete(amenity);
    } else {
      newSelected.add(amenity);
    }
    setSelectedAmenities(newSelected);
  };

  const normalizeAddress = (addr: string | null): string | null => {
    if (!addr) return null;
    return addr
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  };

  const handleSubmit = async () => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      setError('Unable to verify your account. Please sign in and try again.');
      return;
    }

    if (!session || !session.user) {
      const errorMsg = 'Please sign in to add a court.';
      setError(errorMsg);
      Alert.alert('Sign In Required', errorMsg);
      return;
    }

    const userId = session.user.id;

    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a court name.');
      return;
    }

    if (!address.trim()) {
      Alert.alert('Error', 'Please enter an address.');
      return;
    }

    if (selectedSports.size === 0) {
      Alert.alert('Error', 'Please select at least one sport.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Check for duplicate address BEFORE geocoding/inserting
      const trimmedAddress = address.trim();
      const normalizedAddress = normalizeAddress(trimmedAddress);
      
      if (normalizedAddress) {
        const { data: existingCourts, error: findError } = await supabase
          .from('courts')
          .select('id, name, address')
          .not('address', 'is', null);
        
        if (!findError && existingCourts) {
          const duplicateCourt = existingCourts.find(court => 
            court.address && normalizeAddress(court.address) === normalizedAddress
          );
          
          if (duplicateCourt) {
            Alert.alert(
              'Court Already Exists',
              'A court at this address already exists. We\'ll take you there now.',
              [{ text: 'OK', onPress: () => router.replace(`/courts/${duplicateCourt.id}`) }]
            );
            setSubmitting(false);
            return;
          }
        }
      }

      // Geocode the address to get coordinates
      let lat: number | null = null;
      let lng: number | null = null;
      
      if (trimmedAddress) {
        const coordinates = await geocodeAddress(trimmedAddress);
        if (coordinates) {
          lat = coordinates.lat;
          lng = coordinates.lng;
        } else {
          // Geocoding failed, but we'll still create the court
          // User can manually add coordinates later if needed
          devWarn('CourtNew', 'Geocoding failed for address:', trimmedAddress);
        }
      }

      const courtPayload: any = {
        name: name.trim(),
        address: trimmedAddress || null,
        lat,
        lng,
        created_by: userId,
        // Optional detailed fields
        indoor: indoor !== null ? indoor : null,
        hoop_count: hoopCount.trim() ? parseInt(hoopCount.trim(), 10) || null : null,
        court_type: courtType.trim() || null,
        surface_type: surfaceType.trim() || null,
        has_lights: hasLights !== null ? hasLights : null,
        cost: cost.trim() || null,
        hours: hours.trim() || null,
        parking_type: parkingType.trim() || null,
        amenities: selectedAmenities.size > 0 ? Array.from(selectedAmenities) : null,
        notes: notes.trim() || null,
      };
      
      const { data: courtData, error: courtError } = await supabase
        .from('courts')
        .insert(courtPayload)
        .select('id, name, created_by')
        .single();

      if (courtError) {
        // Handle unique constraint violation (backup check - should not happen if above check works)
        if (courtError.code === '23505' && (courtError.message.includes('courts_address_unique') || courtError.message.includes('address'))) {
          Alert.alert(
            'Court Already Exists',
            'A court at this address already exists. Please check the courts list.',
            [{ text: 'OK' }]
          );
          setSubmitting(false);
          return;
        }
        
        let errorMessage = courtError.message || 'Failed to create court.';
        
        if (courtError.code === '42501' || courtError.message.includes('permission') || courtError.message.includes('row-level security')) {
          errorMessage = 'Unable to add court. Please sign in and try again.';
        } else {
          errorMessage = 'Unable to add court. Please try again.';
        }
        
        setError(errorMessage);
        setSubmitting(false);
        return;
      }

      if (!courtData || !courtData.id) {
        setError('Failed to create court: No data returned from server.');
        setSubmitting(false);
        return;
      }

      const courtSports = Array.from(selectedSports).map(sportId => ({
        court_id: courtData.id,
        sport_id: sportId,
      }));

      const { error: sportsError } = await supabase
        .from('court_sports')
        .insert(courtSports)
        .select('court_id, sport_id');

      if (sportsError) {
        await supabase
          .from('courts')
          .delete()
          .eq('id', courtData.id);

        let errorMessage = sportsError.message || 'Failed to add sports to court.';
        
        if (sportsError.code === '42501' || sportsError.message.includes('permission') || sportsError.message.includes('row-level security')) {
          errorMessage = 'Unable to add sports. Please try again.';
        } else {
          errorMessage = 'Unable to add sports. Please try again.';
        }
        
        setError(errorMessage);
        setSubmitting(false);
        return;
      }

      if (comment.trim()) {
        await supabase
          .from('court_comments')
          .insert({
            court_id: courtData.id,
            user_id: userId,
            message: comment.trim(),
          });
      }

      Alert.alert('Court Added', 'Your court has been added successfully!', [
        { text: 'OK', onPress: () => router.replace(`/courts/${courtData.id}`) }
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add court');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading sports...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <KeyboardScreen contentContainerStyle={styles.scrollContent}>
        <Header title="Add Court" showBack={false} />

        <Card>
          <TextInput
            label="Court Name *"
            placeholder="e.g., Central Park Basketball Court"
            value={name}
            onChangeText={setName}
            editable={!submitting}
            maxLength={100}
          />

          <View>
            <Text style={[styles.label, { color: colors.textMuted }]}>Address *</Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>{`If this address already exists, we'll take you to the existing court.`}</Text>
            <RNTextInput
              style={[styles.textArea, { marginBottom: Spacing.lg, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="Full street address"
              placeholderTextColor={colors.textMuted}
              value={address}
              onChangeText={setAddress}
              editable={!submitting}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Sports *</Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>Select at least one sport</Text>
            <View style={styles.sportsContainer}>
              {sports.map((sport) => (
                <Button
                  key={sport.id}
                  title={selectedSports.has(sport.id) ? `${sport.name} ✓` : sport.name}
                  onPress={() => toggleSport(sport.id)}
                  variant={selectedSports.has(sport.id) ? 'primary' : 'secondary'}
                  size="medium"
                  disabled={submitting}
                  style={styles.sportButton}
                />
              ))}
            </View>
          </View>

          {/* Detailed Court Information (Optional) */}
          <View style={styles.section}>
            <AppText variant="h3" color="text" style={styles.sectionHeader}>Court Details (Optional)</AppText>
            
            {/* Indoor/Outdoor Toggle */}
            <View style={styles.toggleRow}>
              <Text style={[styles.label, { color: colors.text }]}>Type</Text>
              <View style={styles.toggleGroup}>
                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    indoor === false && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setIndoor(false)}
                  disabled={submitting}
                >
                  <Text style={[
                    styles.toggleText,
                    { color: indoor === false ? colors.textOnPrimary : colors.text }
                  ]}>Outdoor</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    indoor === true && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setIndoor(true)}
                  disabled={submitting}
                >
                  <Text style={[
                    styles.toggleText,
                    { color: indoor === true ? colors.textOnPrimary : colors.text }
                  ]}>Indoor</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Hoop Count */}
            <TextInput
              label="Hoop Count"
              placeholder="e.g., 4"
              value={hoopCount}
              onChangeText={setHoopCount}
              keyboardType="number-pad"
              editable={!submitting}
            />

            {/* Court Type */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Court Type</Text>
              <View style={styles.optionsContainer}>
                {['Full', 'Half', 'Both'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.optionButton,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      courtType === type && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setCourtType(courtType === type ? '' : type)}
                    disabled={submitting}
                  >
                    <Text style={[
                      styles.optionText,
                      { color: courtType === type ? colors.textOnPrimary : colors.text }
                    ]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Surface Type */}
            <TextInput
              label="Surface Type"
              placeholder="e.g., Hardwood, Asphalt, Sport court"
              value={surfaceType}
              onChangeText={setSurfaceType}
              editable={!submitting}
            />

            {/* Lights Toggle */}
            <View style={styles.toggleRow}>
              <Text style={[styles.label, { color: colors.text }]}>Has Lights</Text>
              <Switch
                value={hasLights || false}
                onValueChange={setHasLights}
                disabled={submitting}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
              />
            </View>

            {/* Cost */}
            <TextInput
              label="Cost"
              placeholder="e.g., Free, $5/hour, Paid"
              value={cost}
              onChangeText={setCost}
              editable={!submitting}
            />

            {/* Hours */}
            <TextInput
              label="Hours"
              placeholder="e.g., 6am - 10pm, 24/7"
              value={hours}
              onChangeText={setHours}
              editable={!submitting}
            />

            {/* Parking Type */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Parking</Text>
              <View style={styles.optionsContainer}>
                {['Street', 'Lot', 'None'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.optionButton,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      parkingType === type && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setParkingType(parkingType === type ? '' : type)}
                    disabled={submitting}
                  >
                    <Text style={[
                      styles.optionText,
                      { color: parkingType === type ? colors.textOnPrimary : colors.text }
                    ]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Amenities */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Amenities</Text>
              <Text style={[styles.hint, { color: colors.textMuted }]}>Select all that apply</Text>
              <View style={styles.amenitiesContainer}>
                {AVAILABLE_AMENITIES.map((amenity) => (
                  <TouchableOpacity
                    key={amenity}
                    style={[
                      styles.amenityChip,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      selectedAmenities.has(amenity) && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => toggleAmenity(amenity)}
                    disabled={submitting}
                  >
                    {selectedAmenities.has(amenity) && (
                      <IconSymbol name="checkmark.circle.fill" size={14} color={colors.textOnPrimary} style={styles.amenityIcon} />
                    )}
                    <Text style={[
                      styles.amenityText,
                      { color: selectedAmenities.has(amenity) ? colors.textOnPrimary : colors.text }
                    ]}>{amenity}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notes */}
            <View>
              <Text style={[styles.label, { color: colors.textMuted }]}>Notes / Rules</Text>
              <RNTextInput
                style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="Additional notes or rules about the court..."
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                editable={!submitting}
                multiline
                numberOfLines={4}
                maxLength={1000}
              />
              <Text style={[styles.charCount, { color: colors.textMuted }]}>{notes.length}/1000</Text>
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: colors.textMuted }]}>Initial Comment (optional)</Text>
            <RNTextInput
              style={[styles.textArea, { marginBottom: Spacing.xs, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="Add a comment about this court..."
              placeholderTextColor={colors.textMuted}
              value={comment}
              onChangeText={setComment}
              editable={!submitting}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={[styles.charCount, { color: colors.textMuted }]}>{comment.length}/500</Text>
          </View>

          {error && (
            <View style={[styles.errorContainer, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
            </View>
          )}

          <Button
            title="Save Court"
            onPress={handleSubmit}
            variant="primary"
            loading={submitting}
            disabled={submitting}
            style={styles.submitButton}
          />
        </Card>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  loadingText: {
    ...Typography.body,
  },
  scrollContent: {
    flexGrow: 1,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.muted,
    marginBottom: Spacing.sm,
  },
  hint: {
    ...Typography.mutedSmall,
    marginBottom: Spacing.sm,
  },
  textArea: {
    ...Typography.body,
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sportsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  sportButton: {
    // Size handled by Button component
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  toggleOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  toggleText: {
    ...Typography.body,
    fontWeight: '600',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  optionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  optionText: {
    ...Typography.body,
    fontWeight: '600',
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  amenityIcon: {
    marginRight: Spacing.xs,
  },
  amenityText: {
    ...Typography.muted,
  },
  charCount: {
    ...Typography.mutedSmall,
    textAlign: 'right',
    marginBottom: Spacing.lg,
  },
  errorContainer: {
    padding: Spacing.md,
    borderRadius: Radius.sm,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  errorText: {
    ...Typography.muted,
  },
  submitButton: {
    marginTop: Spacing.sm,
  },
});
