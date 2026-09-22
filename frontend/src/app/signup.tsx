import React, { useState, useEffect } from 'react';
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
import { signup, fetchDepartments, Department } from '@/services/api';

const ROLES = [
  { key: 'student',            label: 'Student',      icon: '🎓' },
  { key: 'staff',              label: 'Teaching',     icon: '👨‍🏫' },
  { key: 'non_teaching_staff', label: 'Staff',        icon: '🏢' },
  { key: 'department_admin',   label: 'Dept Admin',   icon: '🛡️' },
  { key: 'admin',              label: 'Super Admin',  icon: '👑' },
];

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('student');
  const [phone, setPhone] = useState('');
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
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
  const isDeptRequired = role === 'department_admin';

  useEffect(() => {
    fetchDepartments().then(setDepartments).catch(() => {});
  }, []);

  const handleSignup = async () => {
    setErrorMessage(null);

    if (!name.trim()) { setErrorMessage('Please enter your full name.'); return; }
    if (!isValidEmail) { setErrorMessage('Email must end in @kongu.edu.'); return; }
    if (password.length < 6) { setErrorMessage('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setErrorMessage('Passwords do not match.'); return; }
    if (isDeptRequired && !selectedDept) { setErrorMessage('Please select your department.'); return; }
    if (!agreed) { setErrorMessage('Please accept the terms & conditions.'); return; }

    try {
      setLoading(true);
      await signup({
        name: name.trim(),
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
        role,
        department: selectedDept?.name,
        department_code: selectedDept?.code,
        phone: phone.trim() || undefined,
      });
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
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join the Kongu Lost & Found network</Text>
          </View>

          {/* Error Banner */}
          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠ {errorMessage}</Text>
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.form}>

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Gowtham Kumar"
                  placeholderTextColor="#a0a0a0"
                  value={name}
                  onChangeText={(t) => { setName(t); setErrorMessage(null); }}
                  autoCorrect={false}
                />
                {isNameFilled && <View style={styles.checkCircle}><Text style={styles.checkIcon}>✓</Text></View>}
              </View>
              <View style={styles.underline} />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Campus Email</Text>
                <Text style={styles.domainHint}>@kongu.edu only</Text>
              </View>
              <View style={styles.inputRow}>
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  style={styles.input}
                  placeholder="name@kongu.edu"
                  placeholderTextColor="#a0a0a0"
                  value={email}
                  onChangeText={(t) => { setEmail(t); setErrorMessage(null); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {isValidEmail && <View style={styles.checkCircle}><Text style={styles.checkIcon}>✓</Text></View>}
              </View>
              <View style={styles.underline} />
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone (Optional)</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputIcon}>📱</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+91 9876543210"
                  placeholderTextColor="#a0a0a0"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.underline} />
            </View>

            {/* Role Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Campus Role</Text>
              <View style={styles.roleGrid}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r.key}
                    activeOpacity={0.8}
                    style={[styles.roleChip, role === r.key && styles.roleChipActive]}
                    onPress={() => { setRole(r.key); setSelectedDept(null); }}
                  >
                    <Text style={styles.roleChipIcon}>{r.icon}</Text>
                    <Text style={[styles.roleChipText, role === r.key && styles.roleChipTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Department Selector — available for all users */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Department {isDeptRequired ? <Text style={styles.required}>*</Text> : <Text style={{ color: '#9ca3af', fontSize: 11 }}>(Optional)</Text>}
              </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.deptSelector}
                  onPress={() => setShowDeptPicker(!showDeptPicker)}
                >
                  <Text style={styles.deptIcon}>🏛</Text>
                  <Text style={[styles.deptSelectorText, !selectedDept && { color: '#a0a0a0' }]}>
                    {selectedDept ? `${selectedDept.code} — ${selectedDept.name}` : 'Select your department'}
                  </Text>
                  <Text style={styles.deptArrow}>{showDeptPicker ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {showDeptPicker && (
                  <View style={styles.deptDropdown}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      {departments.map((dept) => (
                        <TouchableOpacity
                          key={dept.code}
                          style={[
                            styles.deptOption,
                            selectedDept?.code === dept.code && styles.deptOptionActive,
                          ]}
                          onPress={() => {
                            setSelectedDept(dept);
                            setShowDeptPicker(false);
                          }}
                        >
                          <Text style={styles.deptOptionCode}>{dept.code}</Text>
                          <Text style={styles.deptOptionName}>{dept.name}</Text>
                          {selectedDept?.code === dept.code && (
                            <Text style={styles.deptOptionCheck}>✓</Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••••••"
                  placeholderTextColor="#a0a0a0"
                  value={password}
                  onChangeText={(t) => { setPassword(t); setErrorMessage(null); }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Text style={styles.toggleIcon}>{showPassword ? '👁' : '👁‍🗨'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.underline} />
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputIcon}>🔐</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••••••"
                  placeholderTextColor="#a0a0a0"
                  value={confirmPassword}
                  onChangeText={(t) => { setConfirmPassword(t); setErrorMessage(null); }}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Text style={styles.toggleIcon}>{showConfirmPassword ? '👁' : '👁‍🗨'}</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.underline, isPasswordMatch && { backgroundColor: '#22c55e' }]} />
              {isPasswordMatch && (
                <Text style={styles.matchHint}>✓ Passwords match</Text>
              )}
            </View>

            {/* Terms Checkbox */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.termsRow}
              onPress={() => setAgreed(!agreed)}
            >
              <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
                {agreed && <Text style={styles.checkboxTick}>✓</Text>}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink}>Terms & Conditions</Text>
                {' '}and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            {/* Dept Admin Notice */}
            {role === 'department_admin' && (
              <View style={styles.adminNotice}>
                <Text style={styles.adminNoticeIcon}>🛡</Text>
                <Text style={styles.adminNoticeText}>
                  Department Admin accounts require approval from the central Admin before activation.
                </Text>
              </View>
            )}

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
                <Text style={styles.signupBtnText}>Create Account →</Text>
              )}
            </TouchableOpacity>

            {/* Switch to Login */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.footerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </DeviceContainer>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  header: { alignItems: 'center', marginBottom: 14 },
  titleSection: { marginBottom: 18 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 4,
    letterSpacing: -0.5,
    fontFamily: 'Poppins-Bold',
  },
  subtitle: {
    fontSize: 13,
    color: '#71717a',
    fontFamily: 'Poppins-Regular',
  },
  errorContainer: {
    backgroundColor: '#fff0f0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffc8c8',
    marginBottom: 14,
  },
  errorText: { color: '#d32f2f', fontSize: 13, fontWeight: '600' },
  form: { gap: 14 },
  inputGroup: { marginBottom: 2 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 6,
    fontFamily: 'Poppins-SemiBold',
  },
  required: { color: '#ef4444' },
  domainHint: { fontSize: 11, color: '#71717a', fontWeight: '500' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  inputIcon: { fontSize: 16, width: 22 },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#111111',
    paddingVertical: 4,
    outlineStyle: 'none' as any,
    fontFamily: 'Poppins-Regular',
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  toggleIcon: { fontSize: 15, paddingHorizontal: 4, color: '#555' },
  underline: { height: 1, backgroundColor: '#e5e5ea', marginTop: 6 },
  matchHint: { fontSize: 11, color: '#22c55e', marginTop: 4, fontWeight: '600' },

  // Role grid — 2×2
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  roleChip: {
    width: '47%',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e5e5ea',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#fafafa',
  },
  roleChipActive: {
    backgroundColor: '#1e1b4b',
    borderColor: '#1e1b4b',
  },
  roleChipIcon: { fontSize: 16 },
  roleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555555',
    fontFamily: 'Poppins-SemiBold',
  },
  roleChipTextActive: { color: '#ffffff' },

  // Department dropdown
  deptSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e5ea',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fafafa',
    gap: 8,
  },
  deptIcon: { fontSize: 16 },
  deptSelectorText: {
    flex: 1,
    fontSize: 13,
    color: '#111',
    fontFamily: 'Poppins-Regular',
  },
  deptArrow: { fontSize: 10, color: '#71717a' },
  deptDropdown: {
    borderWidth: 1,
    borderColor: '#e5e5ea',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  deptOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f5',
    gap: 10,
  },
  deptOptionActive: { backgroundColor: '#f0f0ff' },
  deptOptionCode: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f46e5',
    width: 44,
    fontFamily: 'Poppins-Bold',
  },
  deptOptionName: {
    flex: 1,
    fontSize: 12,
    color: '#374151',
    fontFamily: 'Poppins-Regular',
  },
  deptOptionCheck: { fontSize: 14, color: '#22c55e', fontWeight: 'bold' },

  // Terms
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 2,
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#a0a0a0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  checkboxTick: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: '#71717a',
    lineHeight: 18,
    fontFamily: 'Poppins-Regular',
  },
  termsLink: { color: '#4f46e5', fontWeight: '700' },

  // Admin notice
  adminNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  adminNoticeIcon: { fontSize: 16 },
  adminNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    lineHeight: 18,
    fontFamily: 'Poppins-Regular',
  },

  // Submit
  signupBtn: {
    height: 52,
    backgroundColor: '#1e1b4b',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#1e1b4b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  disabledBtn: { opacity: 0.7 },
  signupBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    fontFamily: 'Poppins-Bold',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  footerText: {
    fontSize: 13,
    color: '#71717a',
    fontFamily: 'Poppins-Regular',
  },
  footerLink: {
    fontSize: 13,
    color: '#4f46e5',
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
});
