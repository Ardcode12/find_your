import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar as RNStatusBar, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TopHeaderProps {
  user: any;
  unreadCount: number;
  onNotificationsClick: () => void;
  onProfileClick: () => void;
}

export default function TopHeader({
  user,
  unreadCount,
  onNotificationsClick,
  onProfileClick,
}: TopHeaderProps) {
  const insets = useSafeAreaInsets();
  const topSafeInset = Platform.OS === 'android'
    ? Math.max(insets.top, RNStatusBar.currentHeight || 28)
    : (Platform.OS === 'ios' ? insets.top : 12);

  const initials = user?.name
    ?.split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'KEC';

  return (
    <View style={[styles.appHeaderBar, { paddingTop: topSafeInset + 8 }]}>
      <View style={styles.brandTitleRow}>
        <View style={styles.brandSquareMark}>
          <Text style={styles.brandSquareMarkText}>K</Text>
        </View>
        <View>
          <Text style={styles.brandTitleText}>CAMPUS FIND</Text>
          <Text style={styles.brandSubTitleText}>Kongu Engineering College</Text>
        </View>
      </View>

      <View style={styles.headerRightIcons}>
        {/* Authoritative Header Notification Bell */}
        <TouchableOpacity
          style={styles.headerIconCircle}
          onPress={onNotificationsClick}
          accessibilityLabel="Notifications"
          activeOpacity={0.75}
        >
          <View style={styles.bellIconVector}>
            <View style={styles.bellTopArc} />
            <View style={styles.bellBaseBar} />
            <View style={styles.bellClapper} />
          </View>
          {unreadCount > 0 && <View style={styles.notificationDot} />}
        </TouchableOpacity>

        {/* User Profile Avatar */}
        <TouchableOpacity
          style={styles.headerAvatarCircle}
          onPress={onProfileClick}
          accessibilityLabel="User Profile"
          activeOpacity={0.75}
        >
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.headerAvatarImg} />
          ) : (
            <Text style={styles.headerAvatarText}>{initials}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandSquareMark: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandSquareMarkText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    fontFamily: 'Poppins-Bold',
  },
  brandTitleText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
    fontFamily: 'Poppins-Bold',
  },
  brandSubTitleText: {
    fontSize: 10.5,
    color: '#8E8E93',
    fontWeight: '500',
    fontFamily: 'Poppins-Regular',
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellIconVector: {
    width: 14,
    height: 16,
    alignItems: 'center',
  },
  bellTopArc: {
    width: 12,
    height: 10,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderWidth: 1.5,
    borderColor: '#111111',
    borderBottomWidth: 0,
  },
  bellBaseBar: {
    width: 14,
    height: 2,
    backgroundColor: '#111111',
    borderRadius: 1,
    marginTop: -0.5,
  },
  bellClapper: {
    width: 3.5,
    height: 2,
    backgroundColor: '#111111',
    borderRadius: 1,
    marginTop: 0.5,
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  headerAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
  },
  headerAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
});
