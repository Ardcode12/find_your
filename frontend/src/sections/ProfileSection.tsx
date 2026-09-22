import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { UserProfile, UserStats } from '@/services/api';

interface ProfileSectionProps {
  user: any;
  profileData: UserProfile | null;
  userStats: UserStats;
  profileNameInput: string;
  setProfileNameInput: (t: string) => void;
  profilePhoneInput: string;
  setProfilePhoneInput: (t: string) => void;
  profileAvatarUrl: string;
  setProfileAvatarUrl: (t: string) => void;
  profileContactPref: 'chat_only' | 'share_email';
  setProfileContactPref: (p: 'chat_only' | 'share_email') => void;
  notifyMatches: boolean;
  setNotifyMatches: (v: boolean) => void;
  notifyClaims: boolean;
  setNotifyClaims: (v: boolean) => void;
  notifyMessages: boolean;
  setNotifyMessages: (v: boolean) => void;
  notifyEmail: boolean;
  setNotifyEmail: (v: boolean) => void;
  savingProfile: boolean;
  onSaveProfile: () => void;
  onBackToHome: () => void;
  onOpenPasswordModal: () => void;
  onOpenGuideModal: () => void;
  onSwitchToActivity: () => void;
  onLogout: () => void;
}

export default function ProfileSection({
  user,
  profileData,
  userStats,
  profileNameInput,
  setProfileNameInput,
  profilePhoneInput,
  setProfilePhoneInput,
  profileAvatarUrl,
  setProfileAvatarUrl,
  profileContactPref,
  setProfileContactPref,
  notifyMatches,
  setNotifyMatches,
  notifyClaims,
  setNotifyClaims,
  notifyMessages,
  setNotifyMessages,
  notifyEmail,
  setNotifyEmail,
  savingProfile,
  onSaveProfile,
  onBackToHome,
  onOpenPasswordModal,
  onOpenGuideModal,
  onSwitchToActivity,
  onLogout,
}: ProfileSectionProps) {
  const [isEditProfileMode, setIsEditProfileMode] = useState(false);

  const initials = user?.name
    ?.split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'KEC';

  const memberDate = profileData?.created_at || user?.created_at
    ? new Date(profileData?.created_at || user?.created_at).toLocaleDateString([], { month: 'short', year: 'numeric' })
    : 'Sep 2026';

  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Photo Permission Required',
          'Please allow access to your device photo gallery to select a profile picture.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        setProfileAvatarUrl(selectedUri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Unable to open photo gallery.');
    }
  };

  return (
    <View style={styles.pageInnerContainer}>
      <View style={styles.pageTopBar}>
        <TouchableOpacity
          style={styles.circularBackBtn}
          onPress={onBackToHome}
          accessibilityLabel="Back to Home"
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitleCenter}>My Profile</Text>
        <TouchableOpacity
          style={[styles.circularHeaderBtn, isEditProfileMode && styles.circularHeaderBtnActive]}
          onPress={() => setIsEditProfileMode(!isEditProfileMode)}
          activeOpacity={0.7}
          accessibilityLabel="Toggle edit profile"
        >
          <Text style={[styles.headerBtnSymbol, isEditProfileMode && styles.headerBtnSymbolActive]}>
            {isEditProfileMode ? '✓' : '✎'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.profileHeaderCard}>
        <View style={styles.avatarWrapper}>
          <TouchableOpacity
            style={styles.profileAvatarLarge}
            onPress={handlePickAvatar}
            activeOpacity={0.85}
          >
            {profileAvatarUrl ? (
              <Image source={{ uri: profileAvatarUrl }} style={styles.profileAvatarLargeImg} />
            ) : (
              <Text style={styles.profileAvatarLargeText}>{initials}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cameraBadgeDisc}
            onPress={handlePickAvatar}
            activeOpacity={0.8}
            accessibilityLabel="Pick profile photo from gallery"
          >
            <View style={styles.cameraIconShape}>
              <View style={styles.cameraBodyShape} />
              <View style={styles.cameraLensShape} />
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.7} style={styles.changePhotoBtn}>
          <Text style={styles.changePhotoBtnText}>📷 Change Profile Photo</Text>
        </TouchableOpacity>

        <Text style={styles.profileNameLarge}>{profileData?.name || user?.name}</Text>
        <View style={styles.rolePillProfile}>
          <Text style={styles.rolePillProfileText}>
            {user?.role?.toUpperCase().replace(/_/g, ' ') || 'STUDENT'}
          </Text>
        </View>
        <Text style={styles.profileEmailSub}>{profileData?.email || user?.email}</Text>
        <Text style={styles.profileMemberSince}>Kongu Engineering College • Member since {memberDate}</Text>
      </View>

      {/* SECTION 3 — Quick Stats Row */}
      <View style={styles.liveStatsStrip}>
        <View style={styles.statMiniCard}>
          <Text style={styles.statMiniNum}>{userStats?.items_reported ?? 0}</Text>
          <Text style={styles.statMiniLabel}>Items Reported</Text>
        </View>
        <View style={styles.statMiniCard}>
          <Text style={styles.statMiniNum}>{userStats?.items_recovered ?? 0}</Text>
          <Text style={styles.statMiniLabel}>Items Recovered</Text>
        </View>
        <View style={styles.statMiniCard}>
          <Text style={styles.statMiniNum}>{userStats?.active_matches ?? 0}</Text>
          <Text style={styles.statMiniLabel}>Active Matches</Text>
        </View>
      </View>

      {/* SECTION 4 — Account Details (Editable Section) */}
      <View style={styles.profileSectionBox}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.profileSectionTitle}>Account Details</Text>
          {isEditProfileMode && <Text style={styles.editModeTag}>Editing Mode</Text>}
        </View>

        {isEditProfileMode ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.fieldLabelSmall}>Full Name</Text>
            <TextInput
              style={styles.textInputField}
              value={profileNameInput}
              onChangeText={setProfileNameInput}
              placeholder="Your full name"
            />

            <Text style={styles.fieldLabelSmall}>Email (Read-only)</Text>
            <View style={styles.readOnlyInputBox}>
              <Text style={styles.readOnlyInputText}>{profileData?.email || user?.email}</Text>
            </View>

            <Text style={styles.fieldLabelSmall}>Role (Institutional)</Text>
            <View style={styles.readOnlyInputBox}>
              <Text style={styles.readOnlyInputText}>
                {user?.role?.toUpperCase().replace(/_/g, ' ') || 'STUDENT'}
              </Text>
            </View>

            <Text style={styles.fieldLabelSmall}>Phone Number (Optional - for staff handovers)</Text>
            <TextInput
              style={styles.textInputField}
              value={profilePhoneInput}
              onChangeText={setProfilePhoneInput}
              placeholder="+91 9876543210"
              placeholderTextColor="#8E8E93"
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={styles.saveProfileBtn}
              onPress={() => {
                onSaveProfile();
                setIsEditProfileMode(false);
              }}
              disabled={savingProfile}
              activeOpacity={0.88}
            >
              {savingProfile ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveProfileBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.infoSummaryBox}>
            <View style={styles.infoSummaryRow}>
              <Text style={styles.infoSummaryLabel}>Full Name</Text>
              <Text style={styles.infoSummaryVal}>{profileData?.name || user?.name}</Text>
            </View>
            <View style={styles.infoSummaryRow}>
              <Text style={styles.infoSummaryLabel}>Email</Text>
              <Text style={styles.infoSummaryVal}>{profileData?.email || user?.email}</Text>
            </View>
            <View style={styles.infoSummaryRow}>
              <Text style={styles.infoSummaryLabel}>Role</Text>
              <Text style={styles.infoSummaryVal}>
                {user?.role?.toUpperCase().replace(/_/g, ' ') || 'STUDENT'}
              </Text>
            </View>
            <View style={styles.infoSummaryRow}>
              <Text style={styles.infoSummaryLabel}>Phone</Text>
              <Text style={styles.infoSummaryVal}>{profileData?.phone_number || 'Not provided'}</Text>
            </View>
          </View>
        )}
      </View>

      {/* SECTION 5 — Notification Preferences */}
      <View style={styles.profileSectionBox}>
        <Text style={styles.profileSectionTitle}>Notification Preferences</Text>
        
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.toggleTitle}>Match Alerts</Text>
            <Text style={styles.toggleSub}>When a found item matches your lost report</Text>
          </View>
          <TouchableOpacity
            style={[styles.customSwitch, notifyMatches && styles.customSwitchOn]}
            onPress={() => setNotifyMatches(!notifyMatches)}
            activeOpacity={0.8}
          >
            <View style={[styles.customSwitchThumb, notifyMatches && styles.customSwitchThumbOn]} />
          </TouchableOpacity>
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.toggleTitle}>Claim / Verification Alerts</Text>
            <Text style={styles.toggleSub}>When someone claims an item you found</Text>
          </View>
          <TouchableOpacity
            style={[styles.customSwitch, notifyClaims && styles.customSwitchOn]}
            onPress={() => setNotifyClaims(!notifyClaims)}
            activeOpacity={0.8}
          >
            <View style={[styles.customSwitchThumb, notifyClaims && styles.customSwitchThumbOn]} />
          </TouchableOpacity>
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.toggleTitle}>Chat Message Alerts</Text>
            <Text style={styles.toggleSub}>Direct messages about items you reported</Text>
          </View>
          <TouchableOpacity
            style={[styles.customSwitch, notifyMessages && styles.customSwitchOn]}
            onPress={() => setNotifyMessages(!notifyMessages)}
            activeOpacity={0.8}
          >
            <View style={[styles.customSwitchThumb, notifyMessages && styles.customSwitchThumbOn]} />
          </TouchableOpacity>
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.toggleTitle}>Email Notifications</Text>
            <Text style={styles.toggleSub}>Receive high-priority updates at your college email</Text>
          </View>
          <TouchableOpacity
            style={[styles.customSwitch, notifyEmail && styles.customSwitchOn]}
            onPress={() => setNotifyEmail(!notifyEmail)}
            activeOpacity={0.8}
          >
            <View style={[styles.customSwitchThumb, notifyEmail && styles.customSwitchThumbOn]} />
          </TouchableOpacity>
        </View>
      </View>

      {/* SECTION 6 — Privacy & Contact Preference */}
      <View style={styles.profileSectionBox}>
        <Text style={styles.profileSectionTitle}>Privacy & Contact Preference</Text>
        <Text style={styles.contactPrefHelperText}>
          Controls how matched users can reach you
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <TouchableOpacity
            style={[styles.prefTabBtn, profileContactPref === 'chat_only' && styles.prefTabBtnActive]}
            onPress={() => setProfileContactPref('chat_only')}
            activeOpacity={0.8}
          >
            <Text style={[styles.prefTabBtnText, profileContactPref === 'chat_only' && styles.prefTabBtnTextActive]}>
              Allow In-App Chat Only
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.prefTabBtn, profileContactPref === 'share_email' && styles.prefTabBtnActive]}
            onPress={() => setProfileContactPref('share_email')}
            activeOpacity={0.8}
          >
            <Text style={[styles.prefTabBtnText, profileContactPref === 'share_email' && styles.prefTabBtnTextActive]}>
              Share Email with Matched Users
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SECTION 7 — Security */}
      <View style={styles.profileSectionBox}>
        <Text style={styles.profileSectionTitle}>Security</Text>
        <TouchableOpacity
          style={styles.outlineActionBtn}
          onPress={onOpenPasswordModal}
          activeOpacity={0.8}
        >
          <Text style={styles.outlineActionBtnText}>Change Password</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dangerActionBtn}
          onPress={onLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.dangerActionBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* SECTION 8 — Quick Links */}
      <View style={styles.quickLinksSection}>
        <TouchableOpacity
          style={styles.quickLinkRow}
          onPress={onSwitchToActivity}
          activeOpacity={0.7}
        >
          <Text style={styles.quickLinkText}>My Reports & Activity</Text>
          <Text style={styles.quickLinkArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLinkRow}
          onPress={onOpenGuideModal}
          activeOpacity={0.7}
        >
          <Text style={styles.quickLinkText}>Help / How It Works</Text>
          <Text style={styles.quickLinkArrow}>→</Text>
        </TouchableOpacity>
        <Text style={styles.versionFooter}>
          Campus Lost & Found v2.1.0 • Kongu Engineering College
        </Text>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  pageInnerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90,
  },
  pageTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  circularBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pageTitleCenter: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
  },
  circularHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularHeaderBtnActive: {
    backgroundColor: '#000000',
  },
  headerBtnSymbol: {
    fontSize: 15,
    color: '#111111',
  },
  headerBtnSymbolActive: {
    color: '#FFFFFF',
  },
  profileHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8ED',
    marginBottom: 14,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  profileAvatarLarge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5E5EA',
  },
  profileAvatarLargeImg: {
    width: '100%',
    height: '100%',
    borderRadius: 38,
  },
  profileAvatarLargeText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  cameraBadgeDisc: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconShape: {
    width: 14,
    height: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBodyShape: {
    width: 13,
    height: 9,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  cameraLensShape: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#000000',
  },
  changePhotoBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    marginBottom: 8,
  },
  changePhotoBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#333333',
  },
  profileNameLarge: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 4,
  },
  rolePillProfile: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 6,
  },
  rolePillProfileText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#555555',
  },
  profileEmailSub: {
    fontSize: 12.5,
    color: '#666666',
    marginBottom: 4,
  },
  profileMemberSince: {
    fontSize: 10.5,
    color: '#8E8E93',
  },
  liveStatsStrip: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statMiniCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  statMiniNum: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
  },
  statMiniLabel: {
    fontSize: 9.5,
    color: '#8E8E93',
    marginTop: 2,
    textAlign: 'center',
  },
  profileSectionBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8E8ED',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  editModeTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  readOnlyInputBox: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readOnlyInputText: {
    fontSize: 13,
    color: '#71717A',
    fontWeight: '600',
  },
  contactPrefHelperText: {
    fontSize: 11.5,
    color: '#8E8E93',
    lineHeight: 16,
  },
  profileSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 12,
  },
  fieldLabelSmall: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#444444',
  },
  textInputField: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#111111',
  },
  prefTabBtn: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  prefTabBtnActive: {
    backgroundColor: '#000000',
  },
  prefTabBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#666666',
  },
  prefTabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  saveProfileBtn: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 6,
  },
  saveProfileBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  infoSummaryBox: {
    gap: 8,
  },
  infoSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoSummaryLabel: {
    fontSize: 12.5,
    color: '#8E8E93',
  },
  infoSummaryVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#111111',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
  },
  toggleSub: {
    fontSize: 11,
    color: '#8E8E93',
  },
  customSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E5EA',
    padding: 2,
    justifyContent: 'center',
  },
  customSwitchOn: {
    backgroundColor: '#000000',
  },
  customSwitchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  customSwitchThumbOn: {
    alignSelf: 'flex-end',
  },
  outlineActionBtn: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 8,
  },
  outlineActionBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#111111',
  },
  dangerActionBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  dangerActionBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  quickLinksSection: {
    marginTop: 8,
    gap: 8,
  },
  quickLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8E8ED',
  },
  quickLinkText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#111111',
  },
  quickLinkArrow: {
    fontSize: 14,
    color: '#8E8E93',
  },
  versionFooter: {
    fontSize: 10.5,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 14,
  },
});
