import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { DeviceContainer } from '@/components/DeviceContainer';
import { BrandLogo } from '@/components/BrandLogo';
import { login } from '@/services/api';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isValidEmail = email.trim().toLowerCase().endsWith('@kongu.edu');

  const handleLogin = async () => {
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      const res = await login({ email: email.trim(), password });
      if (res.user?.role === 'department_admin') {
        router.replace('/department');
      } else if (res.user?.role === 'admin') {
        router.replace('/admin');
      } else {
        router.replace('/dashboard');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DeviceContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand Logo Header */}
          <View style={styles.header}>
            <BrandLogo />
          </View>

          {/* Heading */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Welcome!</Text>
            <Text style={styles.subtitle}>please login or sign up to continue our app</Text>
          </View>

          {/* Error Message Box */}
          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠ {errorMessage}</Text>
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.form}>
            {/* Email Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="name.dept@kongu.edu"
                  placeholderTextColor="#a0a0a0"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {isValidEmail && (
                  <View style={styles.checkCircle}>
                    <Text style={styles.checkIcon}>✓</Text>
                  </View>
                )}
              </View>
              <View style={styles.underline} />
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••••••"
                  placeholderTextColor="#a0a0a0"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <View style={styles.checkCircle}>
                    <Text style={styles.checkIcon}>{showPassword ? '👁' : '✓'}</Text>
                  </View>
                </TouchableOpacity>
              </View>
              <View style={styles.underline} />
            </View>

            {/* Primary Login Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.loginBtn, loading && styles.disabledBtn]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.loginBtnText}>Login</Text>
              )}
            </TouchableOpacity>

            {/* Divider 'or' */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social / Campus SSO Buttons */}
            <View style={styles.socialGroup}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.facebookBtn}
                onPress={() => {
                  setEmail('gowtham.21it@kongu.edu');
                  setPassword('Gowtham@Password2026');
                }}
              >
                <Text style={styles.facebookBtnText}>⚡ Demo Auto-Fill (Kongu Edu)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.outlineBtn}
                onPress={() => {}}
              >
                <Text style={styles.outlineBtnText}>
                  <Text style={styles.boldLetter}>G</Text>  Continue with Google
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.outlineBtn}
                onPress={() => {}}
              >
                <Text style={styles.outlineBtnText}>
                  <Text style={styles.appleIcon}></Text>  Continue with Apple
                </Text>
              </TouchableOpacity>
            </View>

            {/* Switch to Sign Up */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/signup')}>
                <Text style={styles.footerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </DeviceContainer>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 26,
    paddingTop: 36,
    paddingBottom: 36,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  titleSection: {
    marginBottom: 26,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: '#8e8e93',
    fontWeight: '400',
  },
  errorContainer: {
    backgroundColor: '#fff0f0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffc8c8',
    marginBottom: 16,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 13,
    fontWeight: '600',
  },
  form: {
    gap: 18,
  },
  inputGroup: {
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#111111',
    paddingVertical: 4,
    outlineStyle: 'none' as any,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  checkIcon: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  underline: {
    height: 1,
    backgroundColor: '#e5e5ea',
    marginTop: 4,
  },
  loginBtn: {
    height: 50,
    backgroundColor: '#000000',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e5ea',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#8e8e93',
  },
  socialGroup: {
    gap: 10,
  },
  facebookBtn: {
    height: 48,
    backgroundColor: '#3b5998',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facebookBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  outlineBtn: {
    height: 48,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '600',
  },
  boldLetter: {
    fontWeight: '800',
    fontSize: 15,
  },
  appleIcon: {
    fontSize: 16,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  footerText: {
    fontSize: 13,
    color: '#8e8e93',
  },
  footerLink: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '700',
  },
});
