import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT, Region, Callout } from 'react-native-maps';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { fetchCourtsNearLocation, type Court } from '@/lib/courts';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { googlePlacesApiKey } from '@/lib/config';
import { logger } from '@/lib/logger';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';

// Default region (can be customized - here using a central US location as fallback)
const DEFAULT_REGION: Region = {
  latitude: 40.7128,
  longitude: -74.0060,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

type MapCourt = Court & {
  lat: number;
  lng: number;
};

export default function FindCourtsScreen() {
  const router = useRouter();
  const { colors } = useThemeColors();
  const tabBarHeight = React.useContext(BottomTabBarHeightContext) ?? 0;
  const mapRef = useRef<MapView>(null);
  const [courts, setCourts] = useState<MapCourt[]>([]);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const placesApiKey = googlePlacesApiKey ?? '';

  useEffect(() => {
    requestLocationPermission();
    loadCourtsForRegion(region);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermissionStatus(status);
    } catch (err) {
      logger.error('CourtsFind: location permission request failed', { err });
      setLocationPermissionStatus('denied' as Location.PermissionStatus);
    }
  };

  const loadCourtsForRegion = async (mapRegion: Region) => {
    setLoading(true);
    setError(null);

    try {
      const centerLat = mapRegion.latitude;
      const centerLng = mapRegion.longitude;
      
      // Calculate approximate radius in kilometers based on map delta
      // latitudeDelta of 0.01 ≈ 1.1 km, so we estimate radius as half the view span
      const latDeltaKm = mapRegion.latitudeDelta * 111; // 1 degree latitude ≈ 111 km
      const lngDeltaKm = mapRegion.longitudeDelta * 111 * Math.cos(mapRegion.latitude * Math.PI / 180);
      const radiusKm = Math.max(latDeltaKm, lngDeltaKm) / 2;

      const nearbyCourts = await fetchCourtsNearLocation(centerLat, centerLng, radiusKm);
      
      // Filter to only courts with valid coordinates
      const courtsWithCoords = nearbyCourts.filter(
        (court): court is MapCourt => 
          court.lat !== null && 
          court.lng !== null && 
          typeof court.lat === 'number' && 
          typeof court.lng === 'number'
      );

      setCourts(courtsWithCoords);
    } catch (err) {
      logger.error('CourtsFind: load courts for region failed', { err });
      setError("We couldn't load courts for this map area. Try again or zoom out.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegionChangeComplete = (newRegion: Region) => {
    setRegion(newRegion);
    loadCourtsForRegion(newRegion);
  };

  const handleUseMyLocation = async () => {
    if (locationPermissionStatus !== 'granted') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermissionStatus(status);

      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please enable location permissions in your device settings to use this feature.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    setGettingLocation(true);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newRegion: Region = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 1000);
      await loadCourtsForRegion(newRegion);
    } catch (err) {
      logger.error('CourtsFind: get current location failed', { err });
      Alert.alert(
        'Location Error',
        'Unable to get your current location. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setGettingLocation(false);
    }
  };

  const handlePlaceSelected = (data: any, details: any) => {
    if (details?.geometry?.location) {
      const newRegion: Region = {
        latitude: details.geometry.location.lat,
        longitude: details.geometry.location.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 1000);
      loadCourtsForRegion(newRegion);
    }
  };

  const handleMarkerPress = (courtId: string) => {
    router.push(`/courts/${courtId}`);
  };

  return (
    <Screen style={styles.screen}>
      <Header title="Find Courts" showBack={false} />
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <GooglePlacesAutocomplete
          placeholder="Search for an address..."
          onPress={handlePlaceSelected}
          query={{
            key: placesApiKey,
            language: 'en',
            components: 'country:us', // Restrict to US (optional, remove for global)
          }}
          fetchDetails={true}
          enablePoweredByContainer={false}
          styles={{
            container: styles.autocompleteContainer,
            textInputContainer: [
              styles.textInputContainer,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ],
            textInput: [
              styles.textInput,
              {
                color: colors.text,
              },
            ],
            listView: [
              styles.listView,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ],
            row: [
              styles.row,
              {
                borderBottomColor: colors.border,
              },
            ],
            separator: [
              styles.separator,
              {
                backgroundColor: colors.border,
              },
            ],
          }}
          textInputProps={{
            placeholderTextColor: colors.textMuted,
            returnKeyType: 'search',
          }}
          debounce={300}
        />
      </View>

      {/* Use My Location Button */}
      <View style={[styles.locationButtonContainer, { backgroundColor: colors.bg }]}>
        <Button
          title={gettingLocation ? 'Getting Location...' : 'Use My Location'}
          onPress={handleUseMyLocation}
          variant="secondary"
          loading={gettingLocation}
          disabled={gettingLocation}
          style={styles.locationButton}
        />
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
          initialRegion={region}
          onRegionChangeComplete={handleRegionChangeComplete}
          showsUserLocation={locationPermissionStatus === 'granted'}
          showsMyLocationButton={false}
          customMapStyle={[
            {
              elementType: 'geometry',
              stylers: [{ color: '#0A0A0A' }],
            },
            {
              elementType: 'labels.text.fill',
              stylers: [{ color: '#999999' }],
            },
            {
              elementType: 'labels.text.stroke',
              stylers: [{ color: '#0A0A0A' }],
            },
          ]}
        >
          {courts.map((court) => (
            <Marker
              key={court.id}
              coordinate={{
                latitude: court.lat,
                longitude: court.lng,
              }}
              pinColor={colors.primary}
              onPress={() => handleMarkerPress(court.id)}
            >
              <Callout onPress={() => handleMarkerPress(court.id)}>
                <View style={styles.calloutContainer}>
                  <Text style={[styles.calloutTitle, { color: colors.text }]}>{court.name}</Text>
                  {court.address && (
                    <Text style={[styles.calloutAddress, { color: colors.textMuted }]}>{court.address}</Text>
                  )}
                  <Text style={[styles.calloutTap, { color: colors.textMuted }]}>Tap to view details</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>

        {/* Loading Overlay - bottom inset so it never covers the tab bar (TestFlight reliability) */}
        {loading && (
          <View style={[styles.loadingOverlay, { bottom: tabBarHeight }]} pointerEvents="box-none">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading courts...</Text>
          </View>
        )}

        {!loading && error && courts.length === 0 && (
          <View style={[styles.errorOverlay, { bottom: tabBarHeight }]} pointerEvents="box-none">
            <ErrorState onRetry={() => void loadCourtsForRegion(region)} />
          </View>
        )}

        {/* Results Count */}
        {!loading && courts.length > 0 && (
          <View style={[styles.resultsBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.resultsText, { color: colors.textMuted }]}>{courts.length} court{courts.length !== 1 ? 's' : ''} found</Text>
          </View>
        )}

        {/* No Results */}
        {!loading && courts.length === 0 && !error && (
          <View style={[styles.noResultsWrap, { bottom: tabBarHeight }]} pointerEvents="box-none">
            <View style={[styles.noResultsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <EmptyState
                title="No courts found nearby. Add one!"
                subtitle="Pan the map or search another area — or add a court if you know a spot we're missing."
                actionLabel="Add court"
                onAction={() => router.push('/courts/new')}
                icon="mappin.and.ellipse"
              />
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    zIndex: 1,
  },
  autocompleteContainer: {
    flex: 0,
  },
  textInputContainer: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
  },
  textInput: {
    ...Typography.body,
    backgroundColor: 'transparent',
    height: 44,
    paddingHorizontal: Spacing.sm,
  },
  listView: {
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
    borderWidth: 1,
    maxHeight: 200,
  },
  row: {
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  separator: {
    height: 1,
  },
  locationButtonContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    zIndex: 1,
  },
  locationButton: {
    width: '100%',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  resultsBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  resultsText: {
    ...Typography.mutedSmall,
  },
  noResultsWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  noResultsContainer: {
    alignSelf: 'stretch',
    maxWidth: 400,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  calloutContainer: {
    width: 200,
    padding: Spacing.md,
  },
  calloutTitle: {
    ...Typography.bodyBold,
    marginBottom: Spacing.xs,
  },
  calloutAddress: {
    ...Typography.muted,
    marginBottom: Spacing.xs,
  },
  calloutTap: {
    ...Typography.muted,
    fontSize: 12,
    fontStyle: 'italic',
  },
});
