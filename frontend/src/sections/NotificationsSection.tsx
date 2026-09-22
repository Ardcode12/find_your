import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { NotificationItem } from '@/services/api';

interface NotificationsSectionProps {
  notifications: NotificationItem[];
  onBackToHome: () => void;
  onMarkNotificationRead: (id: number) => void;
  onMarkAllRead: () => void;
  onNotificationPress: (notification: NotificationItem) => void;
}

// Relative time formatter
function formatRelativeTime(dateString: string): string {
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    if (isNaN(diffMs) || diffMs < 0) return 'Just now';

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return 'Recent';
  }
}

// Group notifications into Today, Yesterday, and Earlier
function groupNotificationsByDate(items: NotificationItem[]) {
  const groups: { [key: string]: NotificationItem[] } = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  };

  const now = new Date();
  const todayDate = now.toDateString();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const yesterdayDate = yesterday.toDateString();

  items.forEach((item) => {
    try {
      const itemDate = new Date(item.created_at).toDateString();
      if (itemDate === todayDate) {
        groups.Today.push(item);
      } else if (itemDate === yesterdayDate) {
        groups.Yesterday.push(item);
      } else {
        groups.Earlier.push(item);
      }
    } catch {
      groups.Earlier.push(item);
    }
  });

  return groups;
}

export default function NotificationsSection({
  notifications,
  onBackToHome,
  onMarkNotificationRead,
  onMarkAllRead,
  onNotificationPress,
}: NotificationsSectionProps) {
  const [notifFilter, setNotifFilter] = useState<'all' | 'match' | 'claim' | 'status_update' | 'message'>('all');

  const filteredNotifications = useMemo(() => {
    if (notifFilter === 'all') return notifications;
    if (notifFilter === 'claim') {
      return notifications.filter((n) => n.type === 'claim');
    }
    if (notifFilter === 'status_update') {
      return notifications.filter((n) => n.type === 'status_update');
    }
    return notifications.filter((n) => n.type === notifFilter);
  }, [notifications, notifFilter]);

  const dateGroups = useMemo(
    () => groupNotificationsByDate(filteredNotifications),
    [filteredNotifications]
  );

  const hasAnyNotifications = filteredNotifications.length > 0;

  // Render vector icon based on notification type
  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'match':
        // Link / Connect vector
        return (
          <View style={styles.iconLinkWrapper}>
            <View style={styles.iconLinkRingLeft} />
            <View style={styles.iconLinkRingRight} />
          </View>
        );
      case 'claim':
        // Hand / Verification Shield vector
        return (
          <View style={styles.iconShieldWrapper}>
            <View style={styles.iconShieldBody} />
            <View style={styles.iconShieldCheck} />
          </View>
        );
      case 'status_update':
        // Checkmark / Progress circle vector
        return (
          <View style={styles.iconStatusWrapper}>
            <View style={styles.iconStatusCircle} />
            <View style={styles.iconStatusStem} />
            <View style={styles.iconStatusTick} />
          </View>
        );
      case 'message':
      default:
        // Speech bubble vector
        return (
          <View style={styles.iconMessageWrapper}>
            <View style={styles.iconMessageBubble} />
            <View style={styles.iconMessageTail} />
          </View>
        );
    }
  };

  return (
    <View style={styles.pageInnerContainer}>
      {/* SECTION 1 — Top Bar */}
      <View style={styles.pageTopBar}>
        <TouchableOpacity
          style={styles.circularBackBtn}
          onPress={onBackToHome}
          accessibilityLabel="Back to Home"
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitleCenter}>Notifications</Text>
        <TouchableOpacity onPress={onMarkAllRead} activeOpacity={0.7}>
          <Text style={styles.markReadLink}>Mark all as read</Text>
        </TouchableOpacity>
      </View>

      {/* SECTION 2 — Filter Tabs */}
      <View style={styles.tabBarPillContainer}>
        {[
          { id: 'all', label: 'All' },
          { id: 'match', label: 'Matches' },
          { id: 'claim', label: 'Claims' },
          { id: 'status_update', label: 'Status' },
        ].map((f) => {
          const isActive = notifFilter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.tabBarPill, isActive && styles.tabBarPillActive]}
              onPress={() => setNotifFilter(f.id as any)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBarPillText, isActive && styles.tabBarPillTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* SECTION 3 & 4 — Notification List / Empty State */}
      {!hasAnyNotifications ? (
        <View style={styles.emptyStateCard}>
          {/* Bell with a Slash Vector */}
          <View style={styles.emptyBellWrapper}>
            <View style={styles.emptyBellDome} />
            <View style={styles.emptyBellRim} />
            <View style={styles.emptyBellClapper} />
            <View style={styles.emptySlashLine} />
          </View>
          <Text style={styles.emptyStateTitle}>You're all caught up</Text>
          <Text style={styles.emptyStateSub}>No notifications yet.</Text>
        </View>
      ) : (
        <View style={styles.feedWrapper}>
          {(['Today', 'Yesterday', 'Earlier'] as const).map((groupKey) => {
            const list = dateGroups[groupKey];
            if (!list || list.length === 0) return null;

            return (
              <View key={groupKey} style={styles.dateGroupBlock}>
                <Text style={styles.dateGroupHeader}>{groupKey.toUpperCase()}</Text>
                <View style={styles.notificationGroupFeed}>
                  {list.map((item) => {
                    const isUnread = !item.is_read;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.notificationCard, isUnread && styles.notificationCardUnread]}
                        onPress={() => {
                          if (isUnread) onMarkNotificationRead(item.id);
                          onNotificationPress(item);
                        }}
                        activeOpacity={0.82}
                      >
                        {/* Type Icon Disc or Image Thumbnail */}
                        {item.item_image ? (
                          <View style={styles.thumbWrapper}>
                            <Image source={{ uri: item.item_image }} style={styles.itemThumb} />
                            <View style={styles.typeMiniBadge}>
                              {renderTypeIcon(item.type)}
                            </View>
                          </View>
                        ) : (
                          <View style={[styles.iconDisc, isUnread ? styles.iconDiscUnread : styles.iconDiscRead]}>
                            {renderTypeIcon(item.type)}
                          </View>
                        )}

                        {/* Content Column */}
                        <View style={styles.contentCol}>
                          <View style={styles.titleRow}>
                            <Text
                              style={[styles.notifTitleText, isUnread && styles.notifTitleTextUnread]}
                              numberOfLines={1}
                            >
                              {item.title}
                            </Text>
                            {isUnread && <View style={styles.unreadDot} />}
                          </View>
                          <Text
                            style={[styles.notifMessageText, isUnread && styles.notifMessageTextUnread]}
                            numberOfLines={2}
                          >
                            {item.message}
                          </Text>
                          <Text style={styles.notifTimeText}>
                            {formatRelativeTime(item.created_at)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pageInnerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 95,
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
  markReadLink: {
    fontSize: 12.5,
    color: '#000000',
    fontWeight: '700',
  },
  tabBarPillContainer: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 6,
  },
  tabBarPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabBarPillActive: {
    backgroundColor: '#000000',
  },
  tabBarPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  tabBarPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  feedWrapper: {
    gap: 16,
  },
  dateGroupBlock: {
    gap: 8,
  },
  dateGroupHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  notificationGroupFeed: {
    gap: 10,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    alignItems: 'flex-start',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  notificationCardUnread: {
    backgroundColor: '#F7FAFF',
    borderColor: '#C7D9F8',
  },
  thumbWrapper: {
    position: 'relative',
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#E5E5EA',
  },
  typeMiniBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  iconDisc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDiscUnread: {
    backgroundColor: '#000000',
  },
  iconDiscRead: {
    backgroundColor: '#E5E5EA',
  },
  contentCol: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  notifTitleText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#333333',
    flex: 1,
  },
  notifTitleTextUnread: {
    color: '#000000',
    fontWeight: '900',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284C7',
    marginLeft: 6,
  },
  notifMessageText: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 16,
    marginBottom: 5,
  },
  notifMessageTextUnread: {
    color: '#222222',
    fontWeight: '600',
  },
  notifTimeText: {
    fontSize: 10.5,
    color: '#8E8E93',
    fontWeight: '500',
  },

  // Empty State Styles
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 42,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8E8ED',
    marginTop: 10,
  },
  emptyBellWrapper: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  emptyBellDome: {
    width: 28,
    height: 24,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 2.5,
    borderColor: '#8E8E93',
    borderBottomWidth: 0,
  },
  emptyBellRim: {
    width: 36,
    height: 3,
    backgroundColor: '#8E8E93',
    borderRadius: 1.5,
  },
  emptyBellClapper: {
    width: 8,
    height: 5,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: '#8E8E93',
    marginTop: 1,
  },
  emptySlashLine: {
    position: 'absolute',
    width: 44,
    height: 2.5,
    backgroundColor: '#EF4444',
    transform: [{ rotate: '45deg' }],
    borderRadius: 1,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 4,
  },
  emptyStateSub: {
    fontSize: 12.5,
    color: '#666666',
  },

  // VECTOR ICONS (link, shield, status, message)
  // 1. Link / Connect (for match)
  iconLinkWrapper: {
    width: 18,
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLinkRingLeft: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginRight: -4,
  },
  iconLinkRingRight: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // 2. Shield / Verify (for claims)
  iconShieldWrapper: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShieldBody: {
    width: 12,
    height: 13,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  iconShieldCheck: {
    position: 'absolute',
    width: 4,
    height: 7,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: '#000000',
    transform: [{ rotate: '45deg' }],
    top: 5,
  },

  // 3. Status Update (checkmark/progress circle)
  iconStatusWrapper: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconStatusCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  iconStatusStem: {
    position: 'absolute',
    width: 4,
    height: 2,
    backgroundColor: '#FFFFFF',
    left: 6,
    top: 9,
    transform: [{ rotate: '45deg' }],
  },
  iconStatusTick: {
    position: 'absolute',
    width: 7,
    height: 2,
    backgroundColor: '#FFFFFF',
    right: 5,
    top: 8,
    transform: [{ rotate: '-45deg' }],
  },

  // 4. Message Bubble
  iconMessageWrapper: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconMessageBubble: {
    width: 14,
    height: 10,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  iconMessageTail: {
    position: 'absolute',
    bottom: 2,
    left: 4,
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderTopColor: '#FFFFFF',
    borderRightWidth: 4,
    borderRightColor: 'transparent',
  },
});
