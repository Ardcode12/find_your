import React from 'react';
import { View, StyleSheet, Platform, ScrollView, Dimensions } from 'react-native';

interface DeviceContainerProps {
  children: React.ReactNode;
  dark?: boolean;
}

export const DeviceContainer: React.FC<DeviceContainerProps> = ({ children, dark = false }) => {
  if (Platform.OS !== 'web') {
    return <View style={[styles.nativeContainer, dark ? styles.darkBg : styles.lightBg]}>{children}</View>;
  }

  return (
    <View style={styles.webOuter}>
      <View style={[styles.phoneFrame, dark ? styles.darkPhoneFrame : styles.lightPhoneFrame]}>
        {/* iPhone Dynamic Island / Notch */}
        <View style={styles.notchContainer}>
          <View style={styles.speakerPill} />
          <View style={styles.cameraLens} />
        </View>

        {/* Screen Content */}
        <View style={[styles.screenContent, dark ? styles.darkBg : styles.lightBg]}>
          {children}
        </View>

        {/* Home Indicator Bar */}
        <View style={styles.homeBarContainer}>
          <View style={[styles.homeIndicator, dark ? styles.lightIndicator : styles.darkIndicator]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  nativeContainer: {
    flex: 1,
  },
  webOuter: {
    minHeight: '100vh' as any,
    width: '100%',
    backgroundColor: '#0c0d0e',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  phoneFrame: {
    width: 392,
    height: 844,
    borderRadius: 48,
    borderWidth: 10,
    borderColor: '#e2cbaf', // iPhone gold/champagne metallic bezel matching user screenshot
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 36,
    elevation: 20,
    backgroundColor: '#000',
  },
  darkPhoneFrame: {
    borderColor: '#d5b99a',
  },
  lightPhoneFrame: {
    borderColor: '#e6cfb5',
  },
  notchContainer: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: [{ translateX: -70 }],
    width: 140,
    height: 28,
    backgroundColor: '#000',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  speakerPill: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#222',
  },
  cameraLens: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#16233a',
    borderWidth: 1.5,
    borderColor: '#0b1322',
  },
  screenContent: {
    flex: 1,
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  homeBarContainer: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    height: 18,
    zIndex: 998,
    pointerEvents: 'none',
  },
  homeIndicator: {
    width: 134,
    height: 4.5,
    borderRadius: 3,
  },
  lightIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  darkIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  lightBg: {
    backgroundColor: '#ffffff',
  },
  darkBg: {
    backgroundColor: '#000000',
  },
});
