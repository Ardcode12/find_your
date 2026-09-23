import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface BrandLogoProps {
  light?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ light = false }) => {
  return (
    <View style={styles.container}>
      <Text style={[styles.scriptText, light && styles.lightText]}>Lost & Found</Text>
      <Text style={[styles.subText, light && styles.lightSubText]}>Kongu Engineering College</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  scriptText: {
    fontFamily: 'serif',
    fontStyle: 'italic',
    fontSize: 34,
    fontWeight: '300',
    color: '#111111',
    letterSpacing: 0.5,
  },
  lightText: {
    color: '#ffffff',
  },
  subText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: '#555555',
    marginTop: -2,
    fontFamily: 'Poppins-SemiBold',
  },
  lightSubText: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
});
