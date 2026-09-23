import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { DeviceContainer } from '@/components/DeviceContainer';

export default function SuccessScreen() {
  const router = useRouter();

  return (
    <DeviceContainer>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Centered Success Card */}
          <View style={styles.centerContent}>
            {/* Green Circular Badge */}
            <View style={styles.successCircle}>
              <Text style={styles.checkMark}>✓</Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>Successful!</Text>

            {/* Subtitle matching mockup text */}
            <Text style={styles.subtitle}>
              You have successfully registered in our app and start working in it.
            </Text>
          </View>

          {/* Action Button at bottom */}
          <View style={styles.bottomSection}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.actionButton}
              onPress={() => router.replace('/dashboard')}
            >
              <Text style={styles.actionButtonText}>Start Exploring</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.secondaryButton}
              onPress={() => router.replace('/login')}
            >
              <Text style={styles.secondaryButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </DeviceContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 40,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3.5,
    borderColor: '#4cd964',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#4cd964',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  checkMark: {
    color: '#4cd964',
    fontSize: 34,
    fontWeight: '700',
    marginTop: -2,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.3,
    fontFamily: 'Poppins-Bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
    fontFamily: 'Poppins-Regular',
  },
  bottomSection: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  actionButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#000000',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    fontFamily: 'Poppins-Bold',
  },
  secondaryButton: {
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: '#8e8e93',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Poppins-Medium',
  },
});
