// ProfileScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@theme';

export default function ProfileScreen({ route, navigation }) {
  const { employeeId, employeeName } = route.params;
  const [isDarkMode, setIsDarkMode] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ---------------------------------------------------------------
  // Load theme from cache on mount
  // ---------------------------------------------------------------
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_KEY);
        if (stored === 'dark') {
          setIsDarkMode(true);
        } else if (stored === 'light') {
          setIsDarkMode(false);
        }
        // Start fade-in animation
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      } catch (error) {
        console.error('Failed to load theme', error);
      }
    };

    loadTheme();
  }, []);

  // ---------------------------------------------------------------
  // Toggle theme + save to cache
  // ---------------------------------------------------------------
  const toggleTheme = async () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    try {
      await AsyncStorage.setItem(THEME_KEY, newDarkMode ? 'dark' : 'light');
    } catch (error) {
      console.error('Failed to save theme', error);
    }
  };

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDarkMode ? '#fff' : '#1f2937'}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>
            Profile
          </Text>
          <TouchableOpacity onPress={toggleTheme}>
            <Ionicons
              name={isDarkMode ? 'sunny' : 'moon'}
              size={24}
              color={isDarkMode ? '#fff' : '#1f2937'}
            />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <Animated.View style={[styles.card, isDarkMode && styles.cardDark, { opacity: fadeAnim }]}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, isDarkMode && styles.avatarDark]}>
              <Text style={styles.avatarText}>
                {employeeName?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          </View>

          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            My Profile
          </Text>

          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons
                  name="person-circle-outline"
                  size={20}
                  color={isDarkMode ? '#9ca3af' : '#6b7280'}
                />
                <Text style={[styles.label, isDarkMode && styles.labelDark]}>
                  Employee ID:
                </Text>
              </View>
              <Text style={[styles.value, isDarkMode && styles.valueDark]}>
                {employeeId}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons
                  name="id-card-outline"
                  size={20}
                  color={isDarkMode ? '#9ca3af' : '#6b7280'}
                />
                <Text style={[styles.label, isDarkMode && styles.labelDark]}>
                  Name:
                </Text>
              </View>
              <Text style={[styles.value, isDarkMode && styles.valueDark]}>
                {employeeName}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Quick Actions */}
        <View style={[styles.statsCard, isDarkMode && styles.statsCardDark]}>
          <Text style={[styles.statsTitle, isDarkMode && styles.statsTitleDark]}>
            Quick Actions
          </Text>

          <View style={styles.statsRow}>
            <TouchableOpacity
              style={[styles.statItem, isDarkMode && styles.statItemDark]}
              onPress={() => navigation.navigate('History', { employeeId })}
            >
              <Ionicons
                name="time-outline"
                size={24}
                color={isDarkMode ? '#818cf8' : '#4f46e5'}
              />
              <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>
                History
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statItem, isDarkMode && styles.statItemDark]}
              onPress={() => navigation.navigate('Deduct', { employeeId, employeeName })}
            >
              <Ionicons
                name="remove-circle-outline"
                size={24}
                color={isDarkMode ? '#818cf8' : '#4f46e5'}
              />
              <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>
                Deduct
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statItem, isDarkMode && styles.statItemDark]}
              onPress={() => navigation.navigate('Dashboard', { employeeId, employeeName })}
            >
              <Ionicons
                name="home-outline"
                size={24}
                color={isDarkMode ? '#818cf8' : '#4f46e5'}
              />
              <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>
                Home
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// -------------------------------------------------------------------
// Styles (unchanged + optimized)
// -------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  containerDark: {
    backgroundColor: '#1f2937',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  headerTitleDark: {
    color: '#f9fafb',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    marginBottom: 24,
  },
  cardDark: {
    backgroundColor: '#374151',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarDark: {
    backgroundColor: '#818cf8',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 24,
  },
  titleDark: {
    color: '#f9fafb',
  },
  infoContainer: {
    width: '100%',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontWeight: '600',
    color: '#4b5563',
    fontSize: 16,
    marginLeft: 8,
  },
  labelDark: {
    color: '#d1d5db',
  },
  value: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '500',
  },
  valueDark: {
    color: '#f9fafb',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    width: '100%',
  },
  statsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  statsCardDark: {
    backgroundColor: '#374151',
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsTitleDark: {
    color: '#f9fafb',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    minWidth: 80,
  },
  statItemDark: {
    backgroundColor: '#4b5563',
  },
  statLabel: {
    marginTop: 8,
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '500',
  },
  statLabelDark: {
    color: '#d1d5db',
  },
});