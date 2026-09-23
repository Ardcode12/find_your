import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { DeviceContainer } from '@/components/DeviceContainer';
import { BrandLogo } from '@/components/BrandLogo';
import { storage } from '@/services/api';

export default function WelcomeScreen() {
  const router = useRouter();

  useEffect(() => {
    const token = storage.getToken();
    const user = storage.getUser();
    if (token && user) {
      if (user.role === 'department_admin') {
        router.replace('/department');
      } else if (user.role === 'admin') {
        router.replace('/admin');
      } else {
        router.replace('/dashboard');
      }
    }
  }, []);

  return (
    <DeviceContainer dark>
      <ImageBackground
        source={require('../../assets/images/welcome_bg.jpg')}
        style={styles.bgImage}
        resizeMode="cover"
      >
        {/* Dark Vignette Overlay for High Legibility */}
        <View style={styles.overlay}>
          {/* Top spacer for notch */}
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.contentContainer}>
              {/* Brand Logo in Center */}
              <View style={styles.centerBrand}>
                <Text style={styles.cursiveBrand}>Lost & Found</Text>
                <Text style={styles.brandSub}>Kongu Engineering College</Text>
                <Text style={styles.tagline}>Smart Campus Belongings Recovery</Text>
              </View>

              {/* Bottom Call To Action Buttons */}
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.loginButton}
                  onPress={() => router.push('/login')}
                >
                  <Text style={styles.loginButtonText}>Login</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.88}
                  style={styles.signupButton}
                  onPress={() => router.push('/signup')}
                >
                  <Text style={styles.signupButtonText}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </ImageBackground>
    </DeviceContainer>
  );
}

const styles = StyleSheet.create({
  bgImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    justifyContent: 'space-between',
  },
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },
  centerBrand: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cursiveBrand: {
    fontFamily: 'serif',
    fontStyle: 'italic',
    fontSize: 46,
    color: '#ffffff',
    fontWeight: '300',
    letterSpacing: 0.8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  brandSub: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: -2,
    textAlign: 'center',
    fontFamily: 'Poppins-Bold',
  },
  tagline: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 1,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',
  },
  buttonGroup: {
    gap: 14,
    width: '100%',
    alignItems: 'center',
  },
  loginButton: {
    width: '100%',
    height: 54,
    backgroundColor: '#ffffff',
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
    fontFamily: 'Poppins-Bold',
  },
  signupButton: {
    width: '100%',
    height: 54,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
    fontFamily: 'Poppins-SemiBold',
  },
});
