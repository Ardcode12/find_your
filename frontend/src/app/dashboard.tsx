import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  Image,
  Modal,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { DeviceContainer } from '@/components/DeviceContainer';
import {
  storage,
  User,
  Item,
  ChatMessage,
  Claim,
  NotificationItem,
  ActivityData,
  fetchItems,
  fetchItemById,
  createItemReport,
  fetchMyActivity,
  fetchMessages,
  sendMessage,
  submitClaim,
  verifyClaim,
  fetchNotifications,
  analyzeImageWithGemini,
} from '@/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORIES = [
  'All', 'ID Cards', 'Wallets', 'Keys', 'Electronics',
  'Bags', 'Books', 'Jewelry', 'shoes', 'Others',
];

const LOCATIONS = [
  'All', 'Library', 'Hostel Block A', 'Hostel Block B',
  'Canteen', 'FC', 'Bus Stand', 'Main Block',
  'Sports Complex', 'Parking Area', 'Auditorium', 'Main Gate',
];

const STATUS_FILTERS = [
  'All', 'Found', 'Reported', 'Matched', 'Under Verification',
  'Recovered', 'Escalated to Department', 'At Admin Office',
];

const SAMPLE_PHOTO_PRESETS = [
  { label: 'Sneakers', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80' },
  { label: 'Leather Bag', url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80' },
  { label: 'Wallet', url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80' },
  { label: 'AirPods', url: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=600&q=80' },
  { label: 'Keys', url: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80' },
  { label: 'ID Card', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80' },
];

export default function DashboardScreen() {
  const router = useRouter();

  // User State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Feed State
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest'>('recent');
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Saved / Bookmarked Items
  const [savedItemIds, setSavedItemIds] = useState<number[]>([]);

  // Navigation Dock Tab
  const [activeDockTab, setActiveDockTab] = useState<'home' | 'report' | 'activity' | 'notifications' | 'profile'>('home');

  // Detail Modal State (Section 5 - Image 3)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Report Modal State (Section 7)
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportType, setReportType] = useState<'lost' | 'found'>('lost');
  const [reportTitle, setReportTitle] = useState('');
  const [reportCategory, setReportCategory] = useState('ID Cards');
  const [reportDesc, setReportDesc] = useState('');
  const [reportLocation, setReportLocation] = useState('Library');
  const [reportImageUrl, setReportImageUrl] = useState('');
  const [reportIsValuable, setReportIsValuable] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [geminiConfidence, setGeminiConfidence] = useState(0);

  // Chat Modal State (Section 8 - Image 5)
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [chatItem, setChatItem] = useState<Item | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Claim & Verification Modal State (Section 9)
  const [claimModalVisible, setClaimModalVisible] = useState(false);
  const [claimDetails, setClaimDetails] = useState('');
  const [submittingClaim, setSubmittingClaim] = useState(false);

  // Activity Data State (Section 6 - Image 4)
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [activityTab, setActivityTab] = useState<'lost' | 'found' | 'matches' | 'history'>('lost');

  // Notifications State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifModal, setShowNotifModal] = useState(false);

  // Profile Dropdown State
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // Load Initial Data
  useEffect(() => {
    const user = storage.getUser();
    setCurrentUser(user);
    loadFeed();
    loadNotifications();
  }, []);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const data = await fetchItems({
        search: searchQuery,
        category: selectedCategory,
        status: selectedStatus,
        location: selectedLocation,
        sort: sortBy,
        report_type: 'found',
      });
      setItems(data);
    } catch (err) {
      console.log('Error fetching items feed:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const notifs = await fetchNotifications();
      setNotifications(notifs);
    } catch (e) {
      console.log('Error loading notifications:', e);
    }
  };

  const loadActivity = async () => {
    try {
      const act = await fetchMyActivity();
      setActivityData(act);
    } catch (e) {
      console.log('Error loading activity:', e);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  const applyCategoryFilter = (cat: string) => {
    setSelectedCategory(cat);
    fetchItems({
      search: searchQuery,
      category: cat,
      status: selectedStatus,
      location: selectedLocation,
      sort: sortBy,
      report_type: 'found',
    }).then(setItems).catch(console.log);
  };

  const clearAllFilters = () => {
    setSelectedCategory('All');
    setSelectedStatus('All');
    setSelectedLocation('All');
    setSearchQuery('');
    setSortBy('recent');
    fetchItems({ report_type: 'found' }).then(setItems).catch(console.log);
    setShowFilterModal(false);
  };

  const toggleBookmark = (id: number) => {
    if (savedItemIds.includes(id)) {
      setSavedItemIds(savedItemIds.filter((item) => item !== id));
    } else {
      setSavedItemIds([...savedItemIds, id]);
    }
  };

  // Open Item Detail
  const handleOpenDetail = (item: Item) => {
    setSelectedItem(item);
    setDetailModalVisible(true);
  };

  // Open Chat for Item
  const handleOpenChat = async (item: Item) => {
    setChatItem(item);
    setDetailModalVisible(false);
    setChatModalVisible(true);
    try {
      const msgs = await fetchMessages(item.id);
      setChatMessages(msgs);
    } catch (e) {
      console.log('Error fetching messages:', e);
    }
  };

  // Send Message
  const handleSendMessage = async () => {
    if (!newMessageText.trim() || !chatItem) return;
    setSendingMessage(true);
    try {
      const msg = await sendMessage(chatItem.id, newMessageText);
      setChatMessages((prev) => [...prev, msg]);
      setNewMessageText('');
    } catch (e: any) {
      Alert.alert('Send Error', e.message);
    } finally {
      setSendingMessage(false);
    }
  };

  // Open Report Modal
  const handleOpenReport = (type: 'lost' | 'found') => {
    setReportType(type);
    setReportTitle('');
    setReportDesc('');
    setReportCategory('ID Cards');
    setReportLocation('Library');
    setReportImageUrl(SAMPLE_PHOTO_PRESETS[0].url);
    setReportIsValuable(false);
    setReportModalVisible(true);
  };

  // Submit Report
  const handleSubmitReport = async () => {
    if (!reportTitle.trim() || !reportDesc.trim()) {
      Alert.alert('Incomplete Form', 'Please enter item title and description.');
      return;
    }
    setSubmittingReport(true);
    try {
      await createItemReport({
        report_type: reportType,
        title: reportTitle,
        category: reportCategory,
        description: reportDesc,
        location: reportLocation,
        image_url: reportImageUrl,
        is_valuable: reportIsValuable,
      });
      Alert.alert(
        'Report Submitted',
        `Your ${reportType.toUpperCase()} report has been registered. You will be notified immediately when a match is found!`
      );
      setReportModalVisible(false);
      loadFeed();
      loadActivity();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit report.');
    } finally {
      setSubmittingReport(false);
    }
  };

  // Submit Ownership Verification Claim
  const handleSubmitClaim = async () => {
    if (!claimDetails.trim() || !chatItem) {
      Alert.alert('Missing Details', 'Please describe 2-3 hidden identifying details.');
      return;
    }
    setSubmittingClaim(true);
    try {
      await submitClaim(chatItem.id, claimDetails);
      Alert.alert(
        'Claim Submitted',
        'Your verification details have been sent. Once confirmed, status will update to Recovered.'
      );
      setClaimModalVisible(false);
      setClaimDetails('');
      const msgs = await fetchMessages(chatItem.id);
      setChatMessages(msgs);
      loadFeed();
    } catch (e: any) {
      Alert.alert('Claim Error', e.message);
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleLogout = () => {
    storage.clear();
    router.replace('/login');
  };

  const role = currentUser?.role || 'student';
  const isStaff = role === 'staff' || role === 'non_teaching_staff' || role === 'admin' || role === 'department_admin';
  const isDeptAdmin = role === 'department_admin';
  const isSuperAdmin = role === 'admin';
  const roleDisplay = (
    role === 'non_teaching_staff' ? 'Staff' :
    role === 'department_admin' ? 'Dept. Admin' :
    role.charAt(0).toUpperCase() + role.slice(1)
  );

  // Gemini AI image analysis handler
  const handleGeminiAnalyze = async () => {
    if (!reportImageUrl.trim()) {
      Alert.alert('No Image', 'Please enter an image URL first to analyze with AI.');
      return;
    }
    setAnalyzingImage(true);
    try {
      const result = await analyzeImageWithGemini(reportImageUrl);
      if (result.error) {
        Alert.alert('AI Note', result.error);
        return;
      }
      if (result.title) setReportTitle(result.title);
      if (result.category) setReportCategory(result.category);
      if (result.description) setReportDesc(result.description);
      if (result.is_valuable) setReportIsValuable(true);
      setGeminiConfidence(result.confidence);
      Alert.alert(
        '✨ AI Analysis Complete',
        `Auto-filled: "${result.title}" (${result.category})\nConfidence: ${Math.round(result.confidence * 100)}%\n\nPlease review and edit before submitting.`
      );
    } catch (e) {
      Alert.alert('AI Error', 'Image analysis failed. Please fill details manually.');
    } finally {
      setAnalyzingImage(false);
    }
  };

  // Online avatar stories matching Image 4
  const ACTIVE_STORIES = [
    { id: 1, name: 'Kristine', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80' },
    { id: 2, name: 'Kay', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80' },
    { id: 3, name: 'Cheryl', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80' },
    { id: 4, name: 'Jeen', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80' },
    { id: 5, name: 'Gowtham', img: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80' },
  ];

  return (
    <DeviceContainer>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>

          {/* STATUS BAR MOCKUP (Matching Image 1 & 2) */}
          <View style={styles.statusBar}>
            <Text style={styles.statusTime}>4:46</Text>
            <View style={styles.statusIcons}>
              <Text style={styles.statusIconText}>📶 5G</Text>
              <View style={styles.batteryIcon}>
                <View style={styles.batteryFill} />
              </View>
            </View>
          </View>

          {/* SECTION 1: TOP HEADER BAR (Always Visible) */}
          <View style={styles.headerBar}>
            {/* Left Hamburger Icon matching Image 1 */}
            <TouchableOpacity
              style={styles.circleIconBtn}
              activeOpacity={0.8}
              onPress={() => setShowFilterModal(true)}
            >
              <Text style={styles.hamburgerIcon}>☰</Text>
            </TouchableOpacity>

            {/* App Branding */}
            <View style={styles.brandTitleContainer}>
              <Text style={styles.brandTitle}>Campus Lost & Found</Text>
            </View>

            {/* Right Action Icons: Notification Bell + Avatar */}
            <View style={styles.headerRightRow}>
              <TouchableOpacity
                style={styles.bellBtn}
                activeOpacity={0.8}
                onPress={() => {
                  loadNotifications();
                  setShowNotifModal(true);
                }}
              >
                <Text style={styles.bellIcon}>🔔</Text>
                {notifications.some((n) => !n.is_read) && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{notifications.filter((n) => !n.is_read).length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* User Profile Avatar with Role Ring & Dropdown */}
              <TouchableOpacity
                style={styles.avatarBtn}
                activeOpacity={0.8}
                onPress={() => setShowProfileDropdown(!showProfileDropdown)}
              >
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80' }}
                  style={styles.avatarImg}
                />
                <View style={[styles.rolePill, isStaff && styles.staffRolePill]}>
                  <Text style={styles.rolePillText}>{roleDisplay}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* USER PROFILE DROPDOWN MENU */}
          {showProfileDropdown && (
            <View style={styles.profileDropdown}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownName}>{currentUser?.name || 'Campus Member'}</Text>
                <Text style={styles.dropdownEmail}>{currentUser?.email || '@kongu.edu'}</Text>
                {currentUser?.department && (
                  <Text style={styles.dropdownDept}>🏛 {currentUser.department_code} — {currentUser.department}</Text>
                )}
                <View style={[styles.dropdownBadge, isDeptAdmin && { backgroundColor: '#ede9fe' }, isSuperAdmin && { backgroundColor: '#fef3c7' }]}>
                  <Text style={[styles.dropdownBadgeText, isDeptAdmin && { color: '#6d28d9' }, isSuperAdmin && { color: '#92400e' }]}>
                    {isDeptAdmin ? '🛡 Dept. Admin' : isSuperAdmin ? '👑 Admin' : role.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.dropdownDivider} />

              {/* Department Portal */}
              {isDeptAdmin && (
                <TouchableOpacity
                  style={[styles.dropdownItem, { backgroundColor: '#f5f3ff' }]}
                  onPress={() => { setShowProfileDropdown(false); router.push('/department'); }}
                >
                  <Text style={styles.dropdownItemText}>🛡 Department Portal</Text>
                  <View style={styles.dropdownBadgeSmall}><Text style={styles.dropdownBadgeSmallText}>Dept Admin</Text></View>
                </TouchableOpacity>
              )}

              {/* Admin Portal */}
              {isSuperAdmin && (
                <>
                  <TouchableOpacity
                    style={[styles.dropdownItem, { backgroundColor: '#fefce8' }]}
                    onPress={() => { setShowProfileDropdown(false); router.push('/department'); }}
                  >
                    <Text style={styles.dropdownItemText}>🏛 All Departments View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dropdownItem, { backgroundColor: '#fff7ed' }]}
                    onPress={() => { setShowProfileDropdown(false); router.push('/admin'); }}
                  >
                    <Text style={styles.dropdownItemText}>👑 Admin Analytics</Text>
                    <View style={styles.dropdownBadgeSmall}><Text style={styles.dropdownBadgeSmallText}>Admin</Text></View>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setShowProfileDropdown(false);
                  setActiveDockTab('activity');
                  loadActivity();
                }}
              >
                <Text style={styles.dropdownItemText}>📋 My Reports & Claims</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setShowProfileDropdown(false);
                  setShowFilterModal(true);
                }}
              >
                <Text style={styles.dropdownItemText}>⚙️ Search & Filter Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dropdownItem, styles.logoutItem]}
                onPress={() => {
                  setShowProfileDropdown(false);
                  handleLogout();
                }}
              >
                <Text style={styles.logoutItemText}>🚪 Logout</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* MAIN TAB SWITCHER: HOME FEED vs MY ACTIVITY */}
          {activeDockTab === 'activity' ? (
            /* SECTION 6: MY ACTIVITY PANEL (Matching Image 4) */
            <View style={styles.activityContainer}>
              {/* Back to Home row */}
              <View style={styles.activityHeaderRow}>
                <TouchableOpacity
                  style={styles.backCircleBtn}
                  onPress={() => setActiveDockTab('home')}
                >
                  <Text style={styles.backArrowText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.activityScreenTitle}>My Activity & Chats</Text>
                <TouchableOpacity
                  style={styles.bellBtnSmall}
                  onPress={() => setShowNotifModal(true)}
                >
                  <Text style={styles.bellIcon}>🔔</Text>
                </TouchableOpacity>
              </View>

              {/* Online Activities Row (Matching Image 4) */}
              <View style={styles.storiesContainer}>
                <Text style={styles.storiesHeader}>Activities</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
                  {ACTIVE_STORIES.map((st) => (
                    <View key={st.id} style={styles.storyItem}>
                      <View style={styles.storyRing}>
                        <Image source={{ uri: st.img }} style={styles.storyAvatar} />
                      </View>
                      <Text style={styles.storyName}>{st.name}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>

              {/* 4 Activity Tabs */}
              <View style={styles.activityTabBar}>
                <TouchableOpacity
                  style={[styles.activityTabBtn, activityTab === 'lost' && styles.activityTabBtnActive]}
                  onPress={() => setActivityTab('lost')}
                >
                  <Text style={[styles.activityTabText, activityTab === 'lost' && styles.activityTabTextActive]}>
                    My Lost
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.activityTabBtn, activityTab === 'found' && styles.activityTabBtnActive]}
                  onPress={() => setActivityTab('found')}
                >
                  <Text style={[styles.activityTabText, activityTab === 'found' && styles.activityTabTextActive]}>
                    My Found
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.activityTabBtn, activityTab === 'matches' && styles.activityTabBtnActive]}
                  onPress={() => setActivityTab('matches')}
                >
                  <Text style={[styles.activityTabText, activityTab === 'matches' && styles.activityTabTextActive]}>
                    Matches
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.activityTabBtn, activityTab === 'history' && styles.activityTabBtnActive]}
                  onPress={() => setActivityTab('history')}
                >
                  <Text style={[styles.activityTabText, activityTab === 'history' && styles.activityTabTextActive]}>
                    Recovered
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tab Content List */}
              <ScrollView style={styles.activityListScroll} contentContainerStyle={{ paddingBottom: 100 }}>
                {activityTab === 'lost' && (
                  (activityData?.my_lost_reports || []).length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyIcon}>🔍</Text>
                      <Text style={styles.emptyTitle}>No Lost Reports Yet</Text>
                      <Text style={styles.emptySub}>Report an item you lost using the red button.</Text>
                      <TouchableOpacity
                        style={styles.emptyActionBtn}
                        onPress={() => handleOpenReport('lost')}
                      >
                        <Text style={styles.emptyActionBtnText}>+ Report Lost Item</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    activityData?.my_lost_reports.map((item) => (
                      <View key={item.id} style={styles.activityRowCard}>
                        <Image source={{ uri: item.image_url }} style={styles.activityThumb} />
                        <View style={styles.activityRowInfo}>
                          <Text style={styles.activityRowTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.activityRowMeta}>📍 {item.location} • {item.incident_date}</Text>
                          <View style={styles.statusBadgePill}>
                            <Text style={styles.statusBadgeText}>🔴 {item.status}</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.activityActionBtn}
                          onPress={() => handleOpenDetail(item)}
                        >
                          <Text style={styles.activityActionBtnText}>View</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )
                )}

                {activityTab === 'found' && (
                  (activityData?.my_found_reports || []).length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyIcon}>🤝</Text>
                      <Text style={styles.emptyTitle}>No Found Items Reported</Text>
                      <Text style={styles.emptySub}>Help reunite an item with its owner.</Text>
                      <TouchableOpacity
                        style={[styles.emptyActionBtn, { backgroundColor: '#10b981' }]}
                        onPress={() => handleOpenReport('found')}
                      >
                        <Text style={styles.emptyActionBtnText}>+ Report Found Item</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    activityData?.my_found_reports.map((item) => (
                      <View key={item.id} style={styles.activityRowCard}>
                        <Image source={{ uri: item.image_url }} style={styles.activityThumb} />
                        <View style={styles.activityRowInfo}>
                          <Text style={styles.activityRowTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.activityRowMeta}>📍 {item.location} • {item.incident_date}</Text>
                          <View style={[styles.statusBadgePill, { backgroundColor: '#ecfdf5' }]}>
                            <Text style={[styles.statusBadgeText, { color: '#059669' }]}>🟢 {item.status}</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.activityActionBtn}
                          onPress={() => handleOpenDetail(item)}
                        >
                          <Text style={styles.activityActionBtnText}>View</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )
                )}

                {activityTab === 'matches' && (
                  (activityData?.my_matches || []).length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyIcon}>✨</Text>
                      <Text style={styles.emptyTitle}>No Live Matches</Text>
                      <Text style={styles.emptySub}>When an item you reported matches another report, it will appear here!</Text>
                    </View>
                  ) : (
                    activityData?.my_matches.map((item) => (
                      <View key={item.id} style={[styles.activityRowCard, { borderColor: '#f59e0b', borderWidth: 1.5 }]}>
                        <Image source={{ uri: item.image_url }} style={styles.activityThumb} />
                        <View style={styles.activityRowInfo}>
                          <Text style={styles.activityRowTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.activityRowMeta}>⚡ Smart Auto-Match Found</Text>
                          <View style={[styles.statusBadgePill, { backgroundColor: '#fef3c7' }]}>
                            <Text style={[styles.statusBadgeText, { color: '#d97706' }]}>🟡 Matched</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={[styles.activityActionBtn, { backgroundColor: '#000' }]}
                          onPress={() => handleOpenChat(item)}
                        >
                          <Text style={[styles.activityActionBtnText, { color: '#fff' }]}>Open Chat</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )
                )}

                {activityTab === 'history' && (
                  (activityData?.recovered_history || []).length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyIcon}>🎉</Text>
                      <Text style={styles.emptyTitle}>No Recovered Items Yet</Text>
                      <Text style={styles.emptySub}>Completed cases and returned items are archived here.</Text>
                    </View>
                  ) : (
                    activityData?.recovered_history.map((item) => (
                      <View key={item.id} style={styles.activityRowCard}>
                        <Image source={{ uri: item.image_url }} style={styles.activityThumb} />
                        <View style={styles.activityRowInfo}>
                          <Text style={styles.activityRowTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.activityRowMeta}>Recovered on campus</Text>
                          <View style={[styles.statusBadgePill, { backgroundColor: '#ecfdf5' }]}>
                            <Text style={[styles.statusBadgeText, { color: '#059669' }]}>✅ Recovered</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.activityActionBtn}
                          onPress={() => handleOpenDetail(item)}
                        >
                          <Text style={styles.activityActionBtnText}>Archive</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )
                )}
              </ScrollView>
            </View>
          ) : (
            /* HOME FEED VIEW (Sections 2, 3, 4) */
            <ScrollView
              style={styles.mainFeedScroll}
              contentContainerStyle={{ paddingBottom: 110 }}
              showsVerticalScrollIndicator={false}
            >
              {/* GLOBAL SEARCH BAR & FILTER BUTTON (Section 1 center & filter button from Image 1) */}
              <View style={styles.searchBarRow}>
                <View style={styles.searchInputContainer}>
                  <Text style={styles.searchMagnifier}>🔍</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search for an item (e.g. black wallet, ID card...)"
                    placeholderTextColor="#9ca3af"
                    value={searchQuery}
                    onChangeText={handleSearch}
                    onSubmitEditing={loadFeed}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => { setSearchQuery(''); loadFeed(); }}>
                      <Text style={styles.clearSearchText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {/* Circular Black Filter Button matching Image 1 */}
                <TouchableOpacity
                  style={styles.filterCircleBtn}
                  activeOpacity={0.8}
                  onPress={() => setShowFilterModal(true)}
                >
                  <Text style={styles.filterIconText}>🎛</Text>
                </TouchableOpacity>
              </View>

              {/* SECTION 2: HERO / QUICK ACTION AREA (Image 2 style Promos) */}
              <View style={styles.heroSection}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.heroCardsRow}
                  snapToInterval={SCREEN_WIDTH * 0.76}
                  decelerationRate="fast"
                >
                  {/* CARD A: "I Lost Something" (Red/Orange Tone) */}
                  <View style={[styles.heroCard, styles.lostHeroCard]}>
                    <View style={styles.heroCardContent}>
                      <View style={styles.heroBadgeRow}>
                        <Text style={styles.heroEmoji}>🔍</Text>
                        <Text style={styles.heroTagText}>LOST REPORT</Text>
                      </View>
                      <Text style={styles.heroCardTitle}>I Lost Something</Text>
                      <Text style={styles.heroCardSubtitle}>
                        Report an item you've lost and we'll notify you if it's found
                      </Text>
                      <TouchableOpacity
                        style={styles.lostHeroBtn}
                        activeOpacity={0.85}
                        onPress={() => handleOpenReport('lost')}
                      >
                        <Text style={styles.heroBtnText}>Report Lost Item</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* CARD B: "I Found Something" (Emerald Green Tone) */}
                  <View style={[styles.heroCard, styles.foundHeroCard]}>
                    <View style={styles.heroCardContent}>
                      <View style={styles.heroBadgeRow}>
                        <Text style={styles.heroEmoji}>🤝</Text>
                        <Text style={[styles.heroTagText, { color: '#047857' }]}>FOUND REPORT</Text>
                      </View>
                      <Text style={styles.heroCardTitle}>I Found Something</Text>
                      <Text style={styles.heroCardSubtitle}>
                        Help reunite an item with its owner across campus
                      </Text>
                      <TouchableOpacity
                        style={styles.foundHeroBtn}
                        activeOpacity={0.85}
                        onPress={() => handleOpenReport('found')}
                      >
                        <Text style={styles.heroBtnText}>Report Found Item</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>
              </View>

              {/* SECTION 3: CATEGORY FILTER CHIPS (Matching Image 1 Pill Styles) */}
              <View style={styles.categorySection}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScroll}
                >
                  {CATEGORIES.map((cat) => {
                    const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                        activeOpacity={0.8}
                        onPress={() => applyCategoryFilter(cat)}
                      >
                        <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Active Filter Indicators & Clear Link */}
              {(selectedCategory !== 'All' || selectedStatus !== 'All' || selectedLocation !== 'All') && (
                <View style={styles.activeFiltersRow}>
                  <Text style={styles.activeFilterLabel}>
                    Filtered by: {[
                      selectedCategory !== 'All' ? selectedCategory : '',
                      selectedStatus !== 'All' ? selectedStatus : '',
                      selectedLocation !== 'All' ? selectedLocation : '',
                    ].filter(Boolean).join(', ')}
                  </Text>
                  <TouchableOpacity onPress={clearAllFilters}>
                    <Text style={styles.clearFiltersLink}>Clear Filters</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* SECTION 4: FOUND ITEMS FEED HEADER */}
              <View style={styles.feedSectionHeader}>
                <Text style={styles.feedTitle}>Found Items Feed</Text>
                <TouchableOpacity onPress={() => setShowFilterModal(true)}>
                  <Text style={styles.viewAllLink}>{items.length} items</Text>
                </TouchableOpacity>
              </View>

              {/* SECTION 4: 2-COLUMN ITEM CARDS GRID (Matching Image 1 & 2) */}
              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#000" />
                  <Text style={styles.loadingText}>Fetching campus listings...</Text>
                </View>
              ) : items.length === 0 ? (
                /* Empty State */
                <View style={styles.emptyFeedBox}>
                  <Text style={styles.emptyFeedIcon}>📦</Text>
                  <Text style={styles.emptyFeedTitle}>No items found</Text>
                  <Text style={styles.emptyFeedSub}>Try adjusting your search query or clear your active filters.</Text>
                  <TouchableOpacity style={styles.emptyResetBtn} onPress={clearAllFilters}>
                    <Text style={styles.emptyResetText}>Reset All Filters</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.gridContainer}>
                  {items.map((item) => {
                    const isBookmarked = savedItemIds.includes(item.id);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.itemCard}
                        activeOpacity={0.88}
                        onPress={() => handleOpenDetail(item)}
                      >
                        {/* Photo Box with Bookmark Heart */}
                        <View style={styles.itemImageWrapper}>
                          <Image
                            source={{ uri: item.image_url || SAMPLE_PHOTO_PRESETS[0].url }}
                            style={styles.itemImage}
                          />
                          <TouchableOpacity
                            style={styles.heartBtn}
                            onPress={() => toggleBookmark(item.id)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.heartText}>{isBookmarked ? '❤️' : '🖤'}</Text>
                          </TouchableOpacity>

                          {/* High Value Badge */}
                          {item.is_valuable && (
                            <View style={styles.valuableTag}>
                              <Text style={styles.valuableTagText}>🔒 Valuable</Text>
                            </View>
                          )}
                        </View>

                        {/* Item Details */}
                        <View style={styles.itemCardBody}>
                          <Text style={styles.itemCardTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={styles.itemCardDesc} numberOfLines={1}>
                            {item.description}
                          </Text>

                          {/* Category Tag */}
                          <View style={styles.categoryChip}>
                            <Text style={styles.categoryChipText}>{item.category}</Text>
                          </View>

                          {/* Location & Incident Date */}
                          <Text style={styles.itemCardLocation} numberOfLines={1}>
                            📍 {item.location}
                          </Text>
                          <Text style={styles.itemCardTime}>
                            📅 {item.incident_date}
                          </Text>

                          {/* 24h Escalation Timer or Escalated Dept/Admin Badge */}
                          {item.report_type === 'found' && !['Recovered', 'Matched'].includes(item.status) && (
                            item.escalation_level === 'department' ? (
                              <View style={styles.escalationDeptBadge}>
                                <Text style={styles.escalationBadgeText}>🏛️ Dept: {item.assigned_department || 'KEC'}</Text>
                              </View>
                            ) : item.escalation_level === 'admin' ? (
                              <View style={styles.escalationAdminBadge}>
                                <Text style={styles.escalationBadgeText}>🏢 Admin Office</Text>
                              </View>
                            ) : (
                              <View style={styles.escalationTimerBadge}>
                                <Text style={styles.escalationTimerText}>⏱️ 24h Auto-Escalate Active</Text>
                              </View>
                            )
                          )}

                          {/* Status Badge */}
                          <View style={styles.itemCardFooter}>
                            <View style={[
                              styles.statusPill,
                              item.status === 'Recovered' ? styles.statusRecovered :
                              item.status === 'Matched' ? styles.statusMatched :
                              item.status === 'Escalated to Department' || item.status === 'With Department' ? styles.statusDept :
                              item.status === 'At Admin Office' ? styles.statusAdmin :
                              item.status === 'Verified by Department' ? styles.statusVerified :
                              styles.statusAvailable
                            ]}>
                              <Text style={[
                                styles.statusPillText,
                                (item.status === 'Escalated to Department' || item.status === 'With Department') && { color: '#6d28d9' },
                                item.status === 'At Admin Office' && { color: '#c2410c' },
                                item.status === 'Verified by Department' && { color: '#0f766e' },
                                item.status === 'Matched' && { color: '#b45309' },
                              ]}>
                                {item.status === 'Recovered' ? '✅ Recovered' :
                                 item.status === 'Matched' ? '🟡 Matched' :
                                 item.status === 'Escalated to Department' ? `🏛️ Dept (${item.assigned_department || 'KEC'})` :
                                 item.status === 'At Admin Office' ? '🏢 At Admin Office' :
                                 item.status === 'Verified by Department' ? '🛡️ Dept Verified' :
                                 '🟢 Found — Available'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}

          {/* SECTION 10: FLOATING BOTTOM NAVIGATION DOCK (Matching Image 1, 2, 4) */}
          <View style={styles.bottomDockContainer}>
            <View style={styles.bottomDock}>
              {/* Home */}
              <TouchableOpacity
                style={[styles.dockItem, activeDockTab === 'home' && styles.dockItemActive]}
                activeOpacity={0.8}
                onPress={() => setActiveDockTab('home')}
              >
                <Text style={[styles.dockIcon, activeDockTab === 'home' && styles.dockIconActive]}>🏠</Text>
                {activeDockTab === 'home' && <Text style={styles.dockTextActive}>Home</Text>}
              </TouchableOpacity>

              {/* Quick Report '+' */}
              <TouchableOpacity
                style={styles.dockItem}
                activeOpacity={0.8}
                onPress={() => handleOpenReport('found')}
              >
                <Text style={styles.dockIcon}>➕</Text>
              </TouchableOpacity>

              {/* Activity / Messages */}
              <TouchableOpacity
                style={[styles.dockItem, activeDockTab === 'activity' && styles.dockItemActive]}
                activeOpacity={0.8}
                onPress={() => {
                  setActiveDockTab('activity');
                  loadActivity();
                }}
              >
                <Text style={[styles.dockIcon, activeDockTab === 'activity' && styles.dockIconActive]}>💬</Text>
                {activeDockTab === 'activity' && <Text style={styles.dockTextActive}>Activity</Text>}
              </TouchableOpacity>

              {/* Notifications */}
              <TouchableOpacity
                style={styles.dockItem}
                activeOpacity={0.8}
                onPress={() => {
                  loadNotifications();
                  setShowNotifModal(true);
                }}
              >
                <Text style={styles.dockIcon}>🔔</Text>
              </TouchableOpacity>

              {/* Department Portal Entry (Visible to Dept Admin) */}
              {isDeptAdmin && (
                <TouchableOpacity
                  style={[styles.dockItem, { backgroundColor: '#f5f3ff', borderRadius: 14 }]}
                  activeOpacity={0.8}
                  onPress={() => router.push('/department')}
                >
                  <Text style={styles.dockIcon}>🛡️</Text>
                  <Text style={[styles.dockTextActive, { color: '#6366f1' }]}>Dept</Text>
                </TouchableOpacity>
              )}

              {/* Admin Portal Entry (Visible to Super Admin) */}
              {isSuperAdmin && (
                <TouchableOpacity
                  style={[styles.dockItem, { backgroundColor: '#fef3c7', borderRadius: 14 }]}
                  activeOpacity={0.8}
                  onPress={() => router.push('/admin')}
                >
                  <Text style={styles.dockIcon}>👑</Text>
                  <Text style={[styles.dockTextActive, { color: '#b45309' }]}>Admin</Text>
                </TouchableOpacity>
              )}

              {/* Profile */}
              <TouchableOpacity
                style={[styles.dockItem, activeDockTab === 'profile' && styles.dockItemActive]}
                activeOpacity={0.8}
                onPress={() => setShowProfileDropdown(true)}
              >
                <Text style={styles.dockIcon}>👤</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* SECTION 5: ITEM DETAIL MODAL (Matching Image 3) */}
          <Modal
            visible={detailModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setDetailModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.detailCardSheet}>
                {/* Header Back & Action Buttons */}
                <View style={styles.detailHeaderBar}>
                  <TouchableOpacity
                    style={styles.detailBackCircle}
                    onPress={() => setDetailModalVisible(false)}
                  >
                    <Text style={styles.backArrowText}>←</Text>
                  </TouchableOpacity>
                  <Text style={styles.detailHeaderTitle}>Item Details</Text>
                  <TouchableOpacity
                    style={styles.detailBackCircle}
                    onPress={() => selectedItem && toggleBookmark(selectedItem.id)}
                  >
                    <Text style={styles.backArrowText}>
                      {selectedItem && savedItemIds.includes(selectedItem.id) ? '❤️' : '🖤'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {selectedItem && (
                  <ScrollView
                    style={styles.detailScroll}
                    contentContainerStyle={{ paddingBottom: 90 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {/* Big Photo with Carousel Dots */}
                    <View style={styles.detailImageWrapper}>
                      <Image
                        source={{ uri: selectedItem.image_url || SAMPLE_PHOTO_PRESETS[0].url }}
                        style={styles.detailImage}
                      />
                      <View style={styles.carouselDots}>
                        <View style={[styles.dot, styles.dotActive]} />
                        <View style={styles.dot} />
                        <View style={styles.dot} />
                      </View>
                    </View>

                    {/* Content Section */}
                    <View style={styles.detailContent}>
                      <View style={styles.detailTitleRow}>
                        <Text style={styles.detailTitle}>{selectedItem.title}</Text>
                        <View style={styles.detailCategoryBadge}>
                          <Text style={styles.detailCategoryText}>{selectedItem.category}</Text>
                        </View>
                      </View>

                      {/* Status & Availability Tag */}
                      <View style={styles.detailStatusRow}>
                        <Text style={styles.availabilityText}>
                          {selectedItem.status === 'Recovered' ? '✅ Status: Recovered' :
                           selectedItem.status === 'Matched' ? '🟡 Status: Matched (Pending Verification)' :
                           '🟢 Status: Found — Available for Claim'}
                        </Text>
                      </View>

                      {/* Reporter Privacy Safe Box (Only First Name + Role) */}
                      <View style={styles.reporterBox}>
                        <Image
                          source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80' }}
                          style={styles.reporterAvatar}
                        />
                        <View style={styles.reporterTextCol}>
                          <Text style={styles.reporterLabel}>Reported By</Text>
                          <Text style={styles.reporterName}>
                            {selectedItem.reporter_name} ({selectedItem.reporter_role.replace('_', ' ').toUpperCase()})
                          </Text>
                        </View>
                        <View style={styles.shieldBadge}>
                          <Text style={styles.shieldText}>🔒 Safe Contact</Text>
                        </View>
                      </View>

                      {/* Location & Time Info */}
                      <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                          <Text style={styles.metaIcon}>📍</Text>
                          <View>
                            <Text style={styles.metaLabel}>Found Location</Text>
                            <Text style={styles.metaValue}>{selectedItem.location}</Text>
                          </View>
                        </View>
                        <View style={styles.metaItem}>
                          <Text style={styles.metaIcon}>🕒</Text>
                          <View>
                            <Text style={styles.metaLabel}>Incident Time</Text>
                            <Text style={styles.metaValue}>{selectedItem.incident_date} {selectedItem.incident_time}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Status Stepper Timeline */}
                      <View style={styles.timelineSection}>
                        <Text style={styles.sectionHeading}>Recovery Progress</Text>
                        <View style={styles.timelineStepper}>
                          <View style={[styles.timelineStep, styles.timelineStepActive]}>
                            <View style={[styles.timelineCircle, styles.timelineCircleActive]}>
                              <Text style={styles.stepNum}>1</Text>
                            </View>
                            <Text style={styles.stepLabel}>Reported</Text>
                          </View>
                          <View style={styles.timelineLine} />
                          <View style={[styles.timelineStep, (selectedItem.status === 'Matched' || selectedItem.status === 'Under Verification' || selectedItem.status === 'Recovered') && styles.timelineStepActive]}>
                            <View style={[styles.timelineCircle, (selectedItem.status === 'Matched' || selectedItem.status === 'Under Verification' || selectedItem.status === 'Recovered') && styles.timelineCircleActive]}>
                              <Text style={styles.stepNum}>2</Text>
                            </View>
                            <Text style={styles.stepLabel}>Match</Text>
                          </View>
                          <View style={styles.timelineLine} />
                          <View style={[styles.timelineStep, (selectedItem.status === 'Under Verification' || selectedItem.status === 'Recovered') && styles.timelineStepActive]}>
                            <View style={[styles.timelineCircle, (selectedItem.status === 'Under Verification' || selectedItem.status === 'Recovered') && styles.timelineCircleActive]}>
                              <Text style={styles.stepNum}>3</Text>
                            </View>
                            <Text style={styles.stepLabel}>Verify</Text>
                          </View>
                          <View style={styles.timelineLine} />
                          <View style={[styles.timelineStep, selectedItem.status === 'Recovered' && styles.timelineStepActive]}>
                            <View style={[styles.timelineCircle, selectedItem.status === 'Recovered' && styles.timelineCircleActive]}>
                              <Text style={styles.stepNum}>4</Text>
                            </View>
                            <Text style={styles.stepLabel}>Recovered</Text>
                          </View>
                        </View>
                      </View>

                      {/* Description */}
                      <View style={styles.descriptionBox}>
                        <Text style={styles.sectionHeading}>Description</Text>
                        <Text style={styles.descriptionText}>{selectedItem.description}</Text>
                      </View>

                      {/* High-Value Notice */}
                      {selectedItem.is_valuable && (
                        <View style={styles.valuableNoticeBox}>
                          <Text style={styles.valuableNoticeTitle}>⚠️ Non-Teaching Staff Custody</Text>
                          <Text style={styles.valuableNoticeModalText}>
                            This item has been classified as High-Value (e.g. electronics, wallet, ID card). To protect property, it must be verified and collected through the Non-Teaching Staff Custody Desk.
                          </Text>
                        </View>
                      )}
                    </View>
                  </ScrollView>
                )}

                {/* Sticky Action Footer (Matching Image 3 "Add to cart" style) */}
                {selectedItem && (
                  <View style={styles.detailStickyFooter}>
                    <TouchableOpacity
                      style={styles.secondaryDetailBtn}
                      onPress={() => setDetailModalVisible(false)}
                    >
                      <Text style={styles.secondaryDetailBtnText}>Back</Text>
                    </TouchableOpacity>

                    {selectedItem.is_valuable ? (
                      <TouchableOpacity
                        style={[styles.primaryDetailBtn, { backgroundColor: '#d97706' }]}
                        activeOpacity={0.85}
                        onPress={() => {
                          setDetailModalVisible(false);
                          setChatItem(selectedItem);
                          setClaimModalVisible(true);
                        }}
                      >
                        <Text style={styles.primaryDetailBtnText}>Claim via Staff Desk</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.primaryDetailBtn}
                        activeOpacity={0.85}
                        onPress={() => handleOpenChat(selectedItem)}
                      >
                        <Text style={styles.primaryDetailBtnText}>Message Finder</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          </Modal>

          {/* SECTION 7: REPORT ITEM MODAL (Lost or Found) */}
          <Modal
            visible={reportModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setReportModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.reportFormSheet}>
                <View style={styles.reportFormHeader}>
                  <Text style={styles.reportFormTitle}>
                    {reportType === 'lost' ? 'Report Lost Item' : 'Report Found Item'}
                  </Text>
                  <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                    <Text style={styles.closeModalText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.reportFormScroll} showsVerticalScrollIndicator={false}>
                  {/* Item Name */}
                  <Text style={styles.inputLabel}>Item Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Black Leather Wallet, Student ID Card"
                    value={reportTitle}
                    onChangeText={setReportTitle}
                  />

                  {/* Category Dropdown */}
                  <Text style={styles.inputLabel}>Category *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                    {CATEGORIES.filter(c => c !== 'All').map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.formChip, reportCategory === cat && styles.formChipActive]}
                        onPress={() => {
                          setReportCategory(cat);
                          if (['Electronics', 'Wallets', 'ID Cards'].includes(cat)) {
                            setReportIsValuable(true);
                          }
                        }}
                      >
                        <Text style={[styles.formChipText, reportCategory === cat && styles.formChipTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Description */}
                  <Text style={styles.inputLabel}>Description *</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Color, brand, identifying marks, where it was dropped..."
                    multiline
                    numberOfLines={3}
                    value={reportDesc}
                    onChangeText={setReportDesc}
                  />

                  {/* Location Dropdown */}
                  <Text style={styles.inputLabel}>Campus Location *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                    {LOCATIONS.filter(l => l !== 'All').map((loc) => (
                      <TouchableOpacity
                        key={loc}
                        style={[styles.formChip, reportLocation === loc && styles.formChipActive]}
                        onPress={() => setReportLocation(loc)}
                      >
                        <Text style={[styles.formChipText, reportLocation === loc && styles.formChipTextActive]}>
                          {loc}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Photo Preset Selector */}
                  <Text style={styles.inputLabel}>Select Item Photo</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoPresetRow}>
                    {SAMPLE_PHOTO_PRESETS.map((p) => (
                      <TouchableOpacity
                        key={p.label}
                        style={[styles.photoPresetThumbWrap, reportImageUrl === p.url && styles.photoPresetActive]}
                        onPress={() => setReportImageUrl(p.url)}
                      >
                        <Image source={{ uri: p.url }} style={styles.photoPresetThumb} />
                        <Text style={styles.photoPresetLabel}>{p.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Gemini AI Analyze Button */}
                  <TouchableOpacity
                    style={[
                      styles.geminiBtn,
                      analyzingImage && { opacity: 0.7 }
                    ]}
                    activeOpacity={0.85}
                    onPress={handleGeminiAnalyze}
                    disabled={analyzingImage}
                  >
                    {analyzingImage ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.geminiBtnText}>✨ Auto-fill with AI Analysis</Text>
                    )}
                  </TouchableOpacity>
                  {geminiConfidence > 0 && (
                    <Text style={styles.geminiConfText}>
                      🤖 AI Confidence: {Math.round(geminiConfidence * 100)}% — Please review before submitting
                    </Text>
                  )}

                  {/* High Value Toggle */}
                  <TouchableOpacity
                    style={styles.toggleRow}
                    activeOpacity={0.8}
                    onPress={() => setReportIsValuable(!reportIsValuable)}
                  >
                    <View style={styles.toggleTextCol}>
                      <Text style={styles.toggleTitle}>High-Value Item?</Text>
                      <Text style={styles.toggleSubtitle}>Auto-suggested for electronics, wallets & ID cards</Text>
                    </View>
                    <View style={[styles.switchTrack, reportIsValuable && styles.switchTrackActive]}>
                      <View style={[styles.switchThumb, reportIsValuable && styles.switchThumbActive]} />
                    </View>
                  </TouchableOpacity>

                  {/* Department notice for valuable items */}
                  {reportIsValuable && reportType === 'found' && (
                    <View style={styles.valuableNotice}>
                      <Text style={styles.valuableNoticeIcon}>🛡</Text>
                      <Text style={styles.valuableNoticeText}>
                        Valuable item found items are immediately escalated to the Department office for secure keeping.
                      </Text>
                    </View>
                  )}

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[
                      styles.submitReportBtn,
                      reportType === 'lost' ? styles.lostSubmitBtn : styles.foundSubmitBtn
                    ]}
                    activeOpacity={0.85}
                    onPress={handleSubmitReport}
                    disabled={submittingReport}
                  >
                    {submittingReport ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitReportBtnText}>
                        Submit {reportType === 'lost' ? 'Lost Report' : 'Found Report'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* SECTION 8: CHAT / MESSAGING PANEL (Matching Image 5) */}
          <Modal
            visible={chatModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setChatModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.chatSheet}>
                {/* Chat Top Header (Matching Image 5) */}
                <View style={styles.chatTopBar}>
                  <TouchableOpacity
                    style={styles.chatBackBtn}
                    onPress={() => setChatModalVisible(false)}
                  >
                    <Text style={styles.backArrowText}>←</Text>
                  </TouchableOpacity>

                  {/* Recipient / Finder Info Card */}
                  <View style={styles.chatHeaderInfo}>
                    <View style={styles.chatAvatarRing}>
                      <Image
                        source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80' }}
                        style={styles.chatAvatar}
                      />
                    </View>
                    <View>
                      <Text style={styles.chatRecipientName}>
                        {chatItem?.reporter_name || 'Campus Member'}
                      </Text>
                      <View style={styles.onlineRow}>
                        <View style={styles.onlineDot} />
                        <Text style={styles.onlineText}>Online</Text>
                      </View>
                    </View>
                  </View>

                  {/* Quick "Verify & Claim" Action Button in Chat Header */}
                  <TouchableOpacity
                    style={styles.verifyClaimHeaderBtn}
                    onPress={() => setClaimModalVisible(true)}
                  >
                    <Text style={styles.verifyClaimHeaderBtnText}>Verify & Claim</Text>
                  </TouchableOpacity>
                </View>

                {/* Message Thread */}
                <ScrollView
                  style={styles.chatScroll}
                  contentContainerStyle={{ paddingVertical: 16 }}
                  showsVerticalScrollIndicator={false}
                >
                  {/* System Welcome / Auto-Match Banner (Section 8 prompt) */}
                  <View style={styles.systemMatchBanner}>
                    <Text style={styles.systemMatchTitle}>⚡ Match Connected</Text>
                    <Text style={styles.systemMatchText}>
                      You've been connected on "{chatItem?.title}"! Please confirm identifying details before arranging campus pickup.
                    </Text>
                  </View>

                  {chatMessages.map((msg) => {
                    const isMe = msg.sender_id === currentUser?.id;
                    const isSystem = msg.is_system;

                    if (isSystem) {
                      return (
                        <View key={msg.id} style={styles.systemBubble}>
                          <Text style={styles.systemBubbleText}>{msg.message}</Text>
                        </View>
                      );
                    }

                    return (
                      <View
                        key={msg.id}
                        style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}
                      >
                        <View style={[styles.chatBubble, isMe ? styles.myChatBubble : styles.otherChatBubble]}>
                          <Text style={[styles.chatBubbleText, isMe ? styles.myChatBubbleText : styles.otherChatBubbleText]}>
                            {msg.message}
                          </Text>
                        </View>
                        <Text style={styles.chatTimestamp}>
                          {msg.sender_name.split(' ')[0]} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>

                {/* Chat Input Pill (Matching Image 5) */}
                <View style={styles.chatInputContainer}>
                  <View style={styles.chatInputPill}>
                    <TouchableOpacity style={styles.inputActionIcon}>
                      <Text style={{ fontSize: 18 }}>📷</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.chatTextInput}
                      placeholder="Type message..."
                      placeholderTextColor="#9ca3af"
                      value={newMessageText}
                      onChangeText={setNewMessageText}
                      onSubmitEditing={handleSendMessage}
                    />
                    <TouchableOpacity style={styles.inputActionIcon}>
                      <Text style={{ fontSize: 18 }}>🎙</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.inputActionIcon}>
                      <Text style={{ fontSize: 18 }}>📎</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Circular Black Send Button matching Image 5 */}
                  <TouchableOpacity
                    style={styles.sendCircleBtn}
                    activeOpacity={0.8}
                    onPress={handleSendMessage}
                    disabled={sendingMessage}
                  >
                    {sendingMessage ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.sendIconText}>➤</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* SECTION 9: OWNERSHIP VERIFICATION MODAL */}
          <Modal
            visible={claimModalVisible}
            animationType="fade"
            transparent={true}
            onRequestClose={() => setClaimModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.claimDialogSheet}>
                <View style={styles.claimDialogHeader}>
                  <Text style={styles.claimDialogTitle}>Verify Ownership & Claim</Text>
                  <TouchableOpacity onPress={() => setClaimModalVisible(false)}>
                    <Text style={styles.closeModalText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.claimPromptText}>
                  To prevent fraudulent claims, describe 2–3 details about this item that aren't visible in the photo:
                </Text>

                <Text style={styles.claimHintText}>
                  (e.g., specific stickers, lockscreen wallpaper, card names inside, engravings, scratches)
                </Text>

                <TextInput
                  style={[styles.textInput, styles.textArea, { minHeight: 110 }]}
                  placeholder="Detail 1: Inside pocket has my bus pass...&#10;Detail 2: Small star sticker on bottom..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  value={claimDetails}
                  onChangeText={setClaimDetails}
                />

                <View style={styles.claimButtonsRow}>
                  <TouchableOpacity
                    style={styles.cancelClaimBtn}
                    onPress={() => setClaimModalVisible(false)}
                  >
                    <Text style={styles.cancelClaimBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.confirmClaimBtn}
                    onPress={handleSubmitClaim}
                    disabled={submittingClaim}
                  >
                    {submittingClaim ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.confirmClaimBtnText}>Submit Verification</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* If user is Staff / Finder, show direct verification approval button */}
                {isStaff && (
                  <View style={styles.staffApprovalBox}>
                    <Text style={styles.staffApprovalTitle}>🛡 Staff Immediate Action</Text>
                    <TouchableOpacity
                      style={styles.staffApproveBtn}
                      onPress={() => {
                        setClaimModalVisible(false);
                        Alert.alert('Ownership Verified', 'Item marked as RECOVERED! Claimant notified.');
                        loadFeed();
                      }}
                    >
                      <Text style={styles.staffApproveBtnText}>✓ Confirm Ownership & Mark Recovered</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </Modal>

          {/* FILTER MODAL (Section 3) */}
          <Modal
            visible={showFilterModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowFilterModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.filterSheet}>
                <View style={styles.reportFormHeader}>
                  <Text style={styles.reportFormTitle}>Filter & Sort Items</Text>
                  <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                    <Text style={styles.closeModalText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 400 }}>
                  <Text style={styles.inputLabel}>Status</Text>
                  <View style={styles.filterOptionsGrid}>
                    {STATUS_FILTERS.map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={[styles.filterChoicePill, selectedStatus === st && styles.filterChoiceActive]}
                        onPress={() => setSelectedStatus(st)}
                      >
                        <Text style={[styles.filterChoiceText, selectedStatus === st && styles.filterChoiceTextActive]}>
                          {st}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Campus Location</Text>
                  <View style={styles.filterOptionsGrid}>
                    {LOCATIONS.map((loc) => (
                      <TouchableOpacity
                        key={loc}
                        style={[styles.filterChoicePill, selectedLocation === loc && styles.filterChoiceActive]}
                        onPress={() => setSelectedLocation(loc)}
                      >
                        <Text style={[styles.filterChoiceText, selectedLocation === loc && styles.filterChoiceTextActive]}>
                          {loc}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Sort Order</Text>
                  <View style={styles.filterOptionsGrid}>
                    <TouchableOpacity
                      style={[styles.filterChoicePill, sortBy === 'recent' && styles.filterChoiceActive]}
                      onPress={() => setSortBy('recent')}
                    >
                      <Text style={[styles.filterChoiceText, sortBy === 'recent' && styles.filterChoiceTextActive]}>
                        Most Recent
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.filterChoicePill, sortBy === 'oldest' && styles.filterChoiceActive]}
                      onPress={() => setSortBy('oldest')}
                    >
                      <Text style={[styles.filterChoiceText, sortBy === 'oldest' && styles.filterChoiceTextActive]}>
                        Oldest First
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>

                <View style={styles.filterModalActionRow}>
                  <TouchableOpacity style={styles.clearFilterModalBtn} onPress={clearAllFilters}>
                    <Text style={styles.clearFilterModalBtnText}>Clear All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.applyFilterModalBtn}
                    onPress={() => {
                      setShowFilterModal(false);
                      loadFeed();
                    }}
                  >
                    <Text style={styles.applyFilterModalBtnText}>Apply Filters</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* NOTIFICATIONS MODAL */}
          <Modal
            visible={showNotifModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowNotifModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.notifSheet}>
                <View style={styles.reportFormHeader}>
                  <Text style={styles.reportFormTitle}>Notifications</Text>
                  <TouchableOpacity onPress={() => setShowNotifModal(false)}>
                    <Text style={styles.closeModalText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ maxHeight: 380 }}>
                  {notifications.map((n) => (
                    <View key={n.id} style={styles.notifCard}>
                      <Text style={styles.notifIcon}>
                        {n.type === 'match' ? '⚡' : n.type === 'claim' ? '🛡' : '🔔'}
                      </Text>
                      <View style={styles.notifTextCol}>
                        <Text style={styles.notifTitle}>{n.title}</Text>
                        <Text style={styles.notifMessage}>{n.message}</Text>
                        <Text style={styles.notifTime}>
                          {new Date(n.created_at).toLocaleDateString()} {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>

        </View>
      </SafeAreaView>
    </DeviceContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  mainFeedScroll: {
    flex: 1,
  },

  // STATUS BAR
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 4,
  },
  statusTime: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIconText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000',
  },
  batteryIcon: {
    width: 20,
    height: 10,
    borderWidth: 1.5,
    borderColor: '#000',
    borderRadius: 3,
    padding: 1,
    justifyContent: 'center',
  },
  batteryFill: {
    width: 14,
    height: 6,
    backgroundColor: '#000',
    borderRadius: 1.5,
  },

  // SECTION 1: HEADER BAR
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  circleIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburgerIcon: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  brandTitleContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.3,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellIcon: {
    fontSize: 18,
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  avatarBtn: {
    alignItems: 'center',
    position: 'relative',
  },
  avatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e5e7eb',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  rolePill: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: '#000',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  staffRolePill: {
    backgroundColor: '#4f46e5',
  },
  rolePillText: {
    color: '#fff',
    fontSize: 8.5,
    fontWeight: '700',
  },

  // PROFILE DROPDOWN
  profileDropdown: {
    position: 'absolute',
    top: 96,
    right: 16,
    width: 220,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 12,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 15,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  dropdownHeader: {
    paddingBottom: 8,
  },
  dropdownName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  dropdownEmail: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  dropdownBadge: {
    backgroundColor: '#ecfdf5',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  dropdownBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  dropdownDept: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
    marginBottom: 4,
  },
  dropdownBadgeSmall: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  dropdownBadgeSmallText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6b7280',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 6,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  dropdownItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  logoutItem: {
    backgroundColor: '#fef2f2',
    marginTop: 4,
  },
  logoutItemText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 13,
  },
  // Gemini AI
  geminiBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  geminiBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  geminiConfText: {
    fontSize: 11,
    color: '#6366f1',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  // Valuable notice
  valuableNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ede9fe',
    borderRadius: 12,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#c4b5fd',
    marginTop: 6,
  },
  valuableNoticeIcon: { fontSize: 16 },
  valuableNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#5b21b6',
    lineHeight: 18,
  },

  // SEARCH BAR ROW (Image 1 Style)
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
    gap: 10,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 46,
  },
  searchMagnifier: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#111827',
    paddingVertical: 0,
  },
  clearSearchText: {
    fontSize: 14,
    color: '#9ca3af',
    paddingHorizontal: 6,
  },
  filterCircleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIconText: {
    fontSize: 18,
    color: '#ffffff',
  },

  // SECTION 2: HERO ACTION AREA (Image 2 style Promos)
  heroSection: {
    marginTop: 4,
    marginBottom: 8,
  },
  heroCardsRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  heroCard: {
    width: 270,
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  lostHeroCard: {
    backgroundColor: '#fff1f2',
    borderWidth: 1.5,
    borderColor: '#fecdd3',
  },
  foundHeroCard: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
  },
  heroCardContent: {
    flexDirection: 'column',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  heroEmoji: {
    fontSize: 16,
  },
  heroTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#be123c',
    letterSpacing: 0.5,
  },
  heroCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  heroCardSubtitle: {
    fontSize: 12,
    color: '#4b5563',
    lineHeight: 16,
    marginBottom: 14,
  },
  lostHeroBtn: {
    backgroundColor: '#e11d48',
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  foundHeroBtn: {
    backgroundColor: '#059669',
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  heroBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },

  // SECTION 3: CATEGORY CHIPS (Image 1 Style)
  categorySection: {
    marginVertical: 8,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryPillActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  categoryPillTextActive: {
    color: '#ffffff',
  },
  activeFiltersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginVertical: 4,
  },
  activeFilterLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  clearFiltersLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e11d48',
  },

  // SECTION 4: FEED HEADER & 2-COLUMN GRID (Image 1 & 2 Style)
  feedSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginTop: 10,
    marginBottom: 10,
  },
  feedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  viewAllLink: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#6b7280',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  itemCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    overflow: 'hidden',
  },
  itemImageWrapper: {
    width: '100%',
    height: 155,
    backgroundColor: '#f3f4f6',
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartText: {
    fontSize: 13,
  },
  valuableTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  valuableTagText: {
    color: '#fbbf24',
    fontSize: 9.5,
    fontWeight: '700',
  },
  itemCardBody: {
    padding: 10,
  },
  itemCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  itemCardDesc: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  categoryChip: {
    backgroundColor: '#f3f4f6',
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 5,
  },
  categoryChipText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#4b5563',
  },
  itemCardLocation: {
    fontSize: 11,
    color: '#374151',
    marginTop: 6,
  },
  itemCardTime: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  itemCardFooter: {
    marginTop: 8,
  },
  statusPill: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
  },
  statusAvailable: {
    backgroundColor: '#ecfdf5',
  },
  statusMatched: {
    backgroundColor: '#fef3c7',
  },
  statusRecovered: {
    backgroundColor: '#f3f4f6',
  },
  statusDept: {
    backgroundColor: '#ede9fe',
  },
  statusAdmin: {
    backgroundColor: '#ffedd5',
  },
  statusVerified: {
    backgroundColor: '#ccfbf1',
  },
  escalationTimerBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  escalationDeptBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  escalationAdminBadge: {
    backgroundColor: 'rgba(217, 119, 6, 0.9)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  escalationBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  escalationTimerText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },

  // LOADING & EMPTY STATES
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#6b7280',
    fontSize: 13,
  },
  emptyFeedBox: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyFeedIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyFeedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  emptyFeedSub: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  emptyResetBtn: {
    backgroundColor: '#000',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 14,
  },
  emptyResetText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // SECTION 10: BOTTOM DOCK (Images 1, 2, 4)
  bottomDockContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 900,
  },
  bottomDock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 36,
    paddingVertical: 6,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    gap: 12,
  },
  dockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 24,
  },
  dockItemActive: {
    backgroundColor: '#000000',
  },
  dockIcon: {
    fontSize: 18,
  },
  dockIconActive: {
    color: '#ffffff',
  },
  dockTextActive: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },

  // SECTION 6: MY ACTIVITY PANEL (Image 4 Style)
  activityContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  activityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrowText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  activityScreenTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  bellBtnSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storiesContainer: {
    paddingVertical: 8,
  },
  storiesHeader: {
    fontSize: 16,
    fontWeight: '800',
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  storiesScroll: {
    paddingHorizontal: 16,
    gap: 14,
  },
  storyItem: {
    alignItems: 'center',
  },
  storyRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  storyName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    marginTop: 4,
  },
  activityTabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
    marginTop: 8,
  },
  activityTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  activityTabBtnActive: {
    borderColor: '#000',
  },
  activityTabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#9ca3af',
  },
  activityTabTextActive: {
    color: '#000',
    fontWeight: '800',
  },
  activityListScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  activityRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  activityThumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  activityRowInfo: {
    flex: 1,
    marginLeft: 12,
  },
  activityRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  activityRowMeta: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadgePill: {
    backgroundColor: '#fff1f2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#e11d48',
  },
  activityActionBtn: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  activityActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  emptySub: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyActionBtn: {
    backgroundColor: '#e11d48',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 14,
  },
  emptyActionBtnText: {
    color: '#fff',
    fontSize: 12.5,
    fontWeight: '700',
  },

  // SECTION 5: ITEM DETAIL MODAL (Image 3 Style)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  detailCardSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    height: '92%',
    overflow: 'hidden',
  },
  detailHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  detailBackCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  detailScroll: {
    flex: 1,
  },
  detailImageWrapper: {
    width: '100%',
    height: 250,
    backgroundColor: '#f3f4f6',
    position: 'relative',
  },
  detailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  carouselDots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  dotActive: {
    backgroundColor: '#000000',
    width: 18,
  },
  detailContent: {
    padding: 20,
  },
  detailTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  detailCategoryBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  detailCategoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  detailStatusRow: {
    marginTop: 6,
  },
  availabilityText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  reporterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  reporterAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  reporterTextCol: {
    flex: 1,
    marginLeft: 10,
  },
  reporterLabel: {
    fontSize: 10.5,
    color: '#6b7280',
    fontWeight: '600',
  },
  reporterName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  shieldBadge: {
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  shieldText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 12,
  },
  metaItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  metaIcon: {
    fontSize: 16,
  },
  metaLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  timelineSection: {
    marginTop: 18,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  timelineStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  timelineStep: {
    alignItems: 'center',
  },
  timelineStepActive: {},
  timelineCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  timelineCircleActive: {
    backgroundColor: '#000',
  },
  stepNum: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
  },
  timelineLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 4,
    marginBottom: 16,
  },
  descriptionBox: {
    marginTop: 14,
  },
  descriptionText: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 19,
  },
  valuableNoticeBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginTop: 16,
  },
  valuableNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b45309',
    marginBottom: 4,
  },
  valuableNoticeModalText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
  },
  detailStickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  secondaryDetailBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  secondaryDetailBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  primaryDetailBtn: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDetailBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  // SECTION 7: REPORT MODAL
  reportFormSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '88%',
    padding: 20,
  },
  reportFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  reportFormTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  closeModalText: {
    fontSize: 18,
    color: '#6b7280',
    padding: 4,
  },
  reportFormScroll: {
    marginTop: 10,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#111827',
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  formChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  formChipActive: {
    backgroundColor: '#000000',
  },
  formChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  formChipTextActive: {
    color: '#ffffff',
  },
  photoPresetRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoPresetThumbWrap: {
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 12,
    padding: 2,
  },
  photoPresetActive: {
    borderColor: '#000000',
  },
  photoPresetThumb: {
    width: 65,
    height: 65,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  photoPresetLabel: {
    fontSize: 10,
    color: '#4b5563',
    marginTop: 4,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  toggleTextCol: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111827',
  },
  toggleSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e5e7eb',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#10b981',
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  submitReportBtn: {
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  lostSubmitBtn: {
    backgroundColor: '#e11d48',
  },
  foundSubmitBtn: {
    backgroundColor: '#059669',
  },
  submitReportBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  // SECTION 8: CHAT MODAL (Image 5 Style)
  chatSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    height: '92%',
    paddingBottom: 20,
  },
  chatTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  chatBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  chatAvatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  chatAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  chatRecipientName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  onlineText: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
  },
  verifyClaimHeaderBtn: {
    backgroundColor: '#fef3c7',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  verifyClaimHeaderBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d97706',
  },
  chatScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  systemMatchBanner: {
    backgroundColor: '#fef3c7',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  systemMatchTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
    marginBottom: 2,
  },
  systemMatchText: {
    fontSize: 11.5,
    color: '#92400e',
    lineHeight: 16,
  },
  systemBubble: {
    alignSelf: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginVertical: 6,
    maxWidth: '85%',
  },
  systemBubbleText: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },
  messageRow: {
    marginBottom: 12,
  },
  myMessageRow: {
    alignItems: 'flex-end',
  },
  otherMessageRow: {
    alignItems: 'flex-start',
  },
  chatBubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '78%',
  },
  myChatBubble: {
    backgroundColor: '#000000',
    borderBottomRightRadius: 4,
  },
  otherChatBubble: {
    backgroundColor: '#f3f4f6',
    borderBottomLeftRadius: 4,
  },
  chatBubbleText: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  myChatBubbleText: {
    color: '#ffffff',
  },
  otherChatBubbleText: {
    color: '#111827',
  },
  chatTimestamp: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 8,
  },
  chatInputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 26,
    paddingHorizontal: 12,
    height: 48,
  },
  inputActionIcon: {
    padding: 4,
  },
  chatTextInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#111827',
    paddingHorizontal: 6,
  },
  sendCircleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIconText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // SECTION 9: OWNERSHIP VERIFICATION MODAL
  claimDialogSheet: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 22,
    marginHorizontal: 18,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  claimDialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  claimDialogTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  claimPromptText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    lineHeight: 18,
  },
  claimHintText: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 12,
  },
  claimButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelClaimBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  cancelClaimBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  confirmClaimBtn: {
    flex: 2,
    backgroundColor: '#000000',
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  confirmClaimBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  staffApprovalBox: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#f3f4f6',
  },
  staffApprovalTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f46e5',
    marginBottom: 8,
  },
  staffApproveBtn: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  staffApproveBtnText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
  },

  // FILTER MODAL
  filterSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 20,
    maxHeight: '75%',
  },
  filterOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  filterChoicePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  filterChoiceActive: {
    backgroundColor: '#000000',
  },
  filterChoiceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  filterChoiceTextActive: {
    color: '#ffffff',
  },
  filterModalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  clearFilterModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  clearFilterModalBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  applyFilterModalBtn: {
    flex: 2,
    backgroundColor: '#000000',
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  applyFilterModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },

  // NOTIFICATIONS MODAL
  notifSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 20,
    maxHeight: '70%',
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  notifIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  notifTextCol: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111827',
  },
  notifMessage: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 2,
    lineHeight: 16,
  },
  notifTime: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 4,
  },
});
