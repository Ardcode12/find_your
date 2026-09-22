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
import { signup } from '@/services/api';

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'student' | 'staff' | 'non_teaching_staff'>('student');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isValidEmail = email.trim().toLowerCase().endsWith('@kongu.edu');
  const isNameFilled = name.trim().length >= 2;
  const isPasswordValid = password.length >= 6;
  const isPasswordMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSignup = async () => {
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Please enter your campus email.');
      return;
    }
    if (!isValidEmail) {
      setErrorMessage('Email must end in @kongu.edu (rejecting other domains).');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Password and Confirm Password must match.');
      return;
    }
    if (!agreed) {
      setErrorMessage('Please accept the terms & conditions to proceed.');
      return;
    }

    try {
      setLoading(true);
      await signup({
        name: name.trim(),
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
        role,
      });

      // Navigate to Success screen matching mockup
      router.push('/success');
    } catch (err: any) {
      setErrorMessage(err.message || 'Signup failed. Please check your details.');
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
          {/* Top Brand Logo */}
          <View style={styles.header}>
            <BrandLogo />
          </View>

          {/* Heading */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Sign Up</Text>
            <Text style={styles.subtitle}>Create an new account</Text>
          </View>

          {/* Error Banner */}
          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠ {errorMessage}</Text>
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.form}>
            {/* User Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>User Name</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Ferrin or Gowtham"
                  placeholderTextColor="#a0a0a0"
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  autoCorrect={false}
                />
                {isNameFilled && (
                  <View style={styles.checkCircle}>
                    <Text style={styles.checkIcon}>✓</Text>
                  </View>
                )}
              </View>
              <View style={styles.underline} />
            </View>

            {/* Email Field with domain indicator */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.domainHint}>Must end in @kongu.edu</Text>
              </View>
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

            {/* Role Dropdown / Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Campus Role</Text>
              <View style={styles.rolePickerRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.roleChip, role === 'student' && styles.roleChipActive]}
                  onPress={() => setRole('student')}
                >
                  <Text style={[styles.roleChipText, role === 'student' && styles.roleChipTextActive]}>
                    Student
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.roleChip, role === 'staff' && styles.roleChipActive]}
                  onPress={() => setRole('staff')}
                >
                  <Text style={[styles.roleChipText, role === 'staff' && styles.roleChipTextActive]}>
                    Staff
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.roleChip, role === 'non_teaching_staff' && styles.roleChipActive]}
                  onPress={() => setRole('non_teaching_staff')}
                >
                  <Text style={[styles.roleChipText, role === 'non_teaching_staff' && styles.roleChipTextActive]}>
                    Non-teaching
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Password */}
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
                  <View style={styles.toggleCircle}>
                    <Text style={styles.toggleIcon}>{showPassword ? '👁' : '👁‍🗨'}</Text>
                  </View>
                </TouchableOpacity>
              </View>
              <View style={styles.underline} />
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••••••"
                  placeholderTextColor="#a0a0a0"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <View style={styles.toggleCircle}>
                    <Text style={styles.toggleIcon}>{showConfirmPassword ? '👁' : '👁‍🗨'}</Text>
                  </View>
                </TouchableOpacity>
              </View>
              <View style={styles.underline} />
            </View>

            {/* Terms & Conditions Checkbox matching screenshot */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.termsRow}
              onPress={() => setAgreed(!agreed)}
            >
              <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
                {agreed && <Text style={styles.checkboxTick}>✓</Text>}
              </View>
              <Text style={styles.termsText}>
                By creating an account you have to agree with our them & condication.
              </Text>
            </TouchableOpacity>

            {/* Submit Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.signupBtn, loading && styles.disabledBtn]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.signupBtnText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            {/* Switch to Login */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.footerLink}>Login</Text>
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
    marginBottom: 20,
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
    gap: 16,
  },
  inputGroup: {
    marginBottom: 2,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  domainHint: {
    fontSize: 11,
    color: '#71717a',
    fontWeight: '500',
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
  toggleCircle: {
    paddingHorizontal: 4,
    marginLeft: 8,
  },
  toggleIcon: {
    fontSize: 15,
    color: '#222222',
  },
  underline: {
    height: 1,
    backgroundColor: '#e5e5ea',
    marginTop: 4,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  roleChipActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555555',
  },
  roleChipTextActive: {
    color: '#ffffff',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#a0a0a0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  checkboxTick: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: '#8e8e93',
    lineHeight: 16,
  },
  signupBtn: {
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
  signupBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
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
