import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface BottomNavBarProps {
  activeTab: 'home' | 'report' | 'activity' | 'notifications' | 'profile';
  unreadCount: number;
  onTabSwitch: (tab: 'home' | 'report' | 'activity' | 'notifications' | 'profile', source?: any) => void;
}

export default function BottomNavBar({
  activeTab,
  unreadCount,
  onTabSwitch,
}: BottomNavBarProps) {
  return (
    <View style={styles.floatingNavWrapper}>
      <View style={styles.floatingCapsuleBar}>
        {/* 1. Home Tab — Real House Icon (Pointed Roof + House Body + Door) */}
        <TouchableOpacity
          style={[styles.floatingTabItem, activeTab === 'home' && styles.floatingTabItemActivePill]}
          onPress={() => onTabSwitch('home')}
          accessibilityLabel="Home Feed"
          activeOpacity={0.8}
        >
          <View style={styles.navIconContainer}>
            {/* Pointed Roof Triangle */}
            <View style={[styles.houseRoofTriangle, activeTab === 'home' && styles.houseRoofActive]} />
            {/* House Body with Door Cutout */}
            <View style={[styles.houseBaseBox, activeTab === 'home' && styles.shapeActiveWhite]}>
              <View style={[styles.houseDoorCutout, activeTab === 'home' && styles.houseDoorActive]} />
            </View>
          </View>
          {activeTab === 'home' && <Text style={styles.navPillActiveText}>Home</Text>}
        </TouchableOpacity>

        {/* 2. Activity Tab — Document / Checklist Icon */}
        <TouchableOpacity
          style={[styles.floatingTabItem, activeTab === 'activity' && styles.floatingTabItemActivePill]}
          onPress={() => onTabSwitch('activity')}
          accessibilityLabel="My Activity"
          activeOpacity={0.8}
        >
          <View style={styles.navIconContainer}>
            <View style={[styles.tasksRectShape, activeTab === 'activity' && styles.tasksBorderActive]}>
              <View style={[styles.tasksLineShape, activeTab === 'activity' && styles.shapeActiveWhite]} />
              <View style={[styles.tasksLineShort, activeTab === 'activity' && styles.shapeActiveWhite]} />
            </View>
          </View>
          {activeTab === 'activity' && <Text style={styles.navPillActiveText}>Activity</Text>}
        </TouchableOpacity>

        {/* 3. Dead Center: Report (+) Button */}
        <TouchableOpacity
          style={[styles.centerAddButtonDisc, activeTab === 'report' && styles.centerAddButtonDiscActive]}
          onPress={() => onTabSwitch('report', 'navbar_plus')}
          accessibilityLabel="Report Item"
          activeOpacity={0.85}
        >
          <Text style={styles.centerAddPlusGlyph}>+</Text>
        </TouchableOpacity>

        {/* 4. Notifications Tab — Visually Identical Bell Icon to Header Bell */}
        <TouchableOpacity
          style={[styles.floatingTabItem, activeTab === 'notifications' && styles.floatingTabItemActivePill]}
          onPress={() => onTabSwitch('notifications')}
          accessibilityLabel="Notifications"
          activeOpacity={0.8}
        >
          <View style={styles.navIconContainer}>
            <View style={styles.bellIconVector}>
              <View style={[styles.bellTopArc, activeTab === 'notifications' && styles.shapeActiveWhite]} />
              <View style={[styles.bellBaseBar, activeTab === 'notifications' && styles.shapeActiveWhite]} />
              <View style={[styles.bellClapper, activeTab === 'notifications' && styles.shapeActiveWhite]} />
            </View>
            {unreadCount > 0 && <View style={styles.navUnreadRedBadge} />}
          </View>
          {activeTab === 'notifications' && <Text style={styles.navPillActiveText}>Alerts</Text>}
        </TouchableOpacity>

        {/* 5. Profile Tab — Head Circle + Body Arc */}
        <TouchableOpacity
          style={[styles.floatingTabItem, activeTab === 'profile' && styles.floatingTabItemActivePill]}
          onPress={() => onTabSwitch('profile')}
          accessibilityLabel="My Profile"
          activeOpacity={0.8}
        >
          <View style={styles.navIconContainer}>
            <View style={[styles.userHeadCircle, activeTab === 'profile' && styles.shapeActiveWhite]} />
            <View style={[styles.userBodyArc, activeTab === 'profile' && styles.shapeActiveWhite]} />
          </View>
          {activeTab === 'profile' && <Text style={styles.navPillActiveText}>Profile</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingNavWrapper: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 999,
  },
  floatingCapsuleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1E',
    borderRadius: 34,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '100%',
    maxWidth: 395,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  floatingTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 6,
  },
  floatingTabItemActivePill: {
    backgroundColor: '#323236',
  },
  navIconContainer: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  navPillActiveText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  shapeActiveWhite: {
    backgroundColor: '#FFFFFF',
  },

  // 1. HOUSE ICON: Realistic pointed roof triangle + base box + door cutout
  houseRoofTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#8E8E93',
  },
  houseRoofActive: {
    borderBottomColor: '#FFFFFF',
  },
  houseBaseBox: {
    width: 12,
    height: 8,
    backgroundColor: '#8E8E93',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderBottomLeftRadius: 1.5,
    borderBottomRightRadius: 1.5,
  },
  houseDoorCutout: {
    width: 4,
    height: 5,
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  houseDoorActive: {
    backgroundColor: '#323236',
  },

  // 2. ACTIVITY ICON
  tasksRectShape: {
    width: 14,
    height: 15,
    borderWidth: 1.5,
    borderColor: '#8E8E93',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 1,
    gap: 2,
  },
  tasksBorderActive: {
    borderColor: '#FFFFFF',
  },
  tasksLineShape: {
    width: 8,
    height: 1.5,
    backgroundColor: '#8E8E93',
    borderRadius: 1,
  },
  tasksLineShort: {
    width: 5,
    height: 1.5,
    backgroundColor: '#8E8E93',
    borderRadius: 1,
    alignSelf: 'flex-start',
    marginLeft: 1.5,
  },

  // 3. CENTER ADD (+) BUTTON
  centerAddButtonDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
    marginHorizontal: 4,
  },
  centerAddButtonDiscActive: {
    backgroundColor: '#E5E5EA',
  },
  centerAddPlusGlyph: {
    color: '#000000',
    fontSize: 26,
    fontWeight: '300',
    lineHeight: 28,
  },

  // 4. NOTIFICATIONS BELL ICON (Identical 3-part vector structure to Top Header)
  bellIconVector: {
    width: 14,
    height: 16,
    alignItems: 'center',
  },
  bellTopArc: {
    width: 11,
    height: 9,
    borderTopLeftRadius: 5.5,
    borderTopRightRadius: 5.5,
    backgroundColor: '#8E8E93',
  },
  bellBaseBar: {
    width: 14,
    height: 2,
    backgroundColor: '#8E8E93',
    borderRadius: 1,
    marginTop: 1,
  },
  bellClapper: {
    width: 4,
    height: 2,
    backgroundColor: '#8E8E93',
    borderRadius: 1,
    marginTop: 1,
  },
  navUnreadRedBadge: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#1C1C1E',
  },

  // 5. PROFILE ICON
  userHeadCircle: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#8E8E93',
    marginBottom: 2,
  },
  userBodyArc: {
    width: 13,
    height: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: '#8E8E93',
  },
});
