import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  ToastAndroid,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import TopHeader from '@/sections/TopHeader';
import BottomNavBar from '@/sections/BottomNavBar';
import HomeSection from '@/sections/HomeSection';
import ReportSection from '@/sections/ReportSection';
import ActivitySection from '@/sections/ActivitySection';
import NotificationsSection from '@/sections/NotificationsSection';
import ProfileSection from '@/sections/ProfileSection';
import {
  Item,
  ChatMessage,
  Claim,
  NotificationItem,
  ActivityData,
  MatchItem,
  UserProfile,
  UserStats,
  storage,
  fetchItems,
  fetchItemById,
  createItemReport,
  updateItemReport,
  withdrawItemReport,
  fetchMyActivity,
  fetchMyMatches,
  fetchMessages,
  sendMessage,
  submitClaim,
  verifyClaim,
  fetchItemClaims,
  fetchNotifications,
  analyzeImageWithGemini,
  markNotificationRead,
  markAllNotificationsRead,
  fetchUnreadCount,
  fetchHomeStats,
  analyzePhoto,
  fetchUserProfile,
  updateUserProfile,
  changePassword,
  fetchUserStats,
  studentDeliverToOwner,
} from '@/services/api';

const CATEGORIES = [
  'All',
  'ID Cards',
  'Wallets',
  'Keys',
  'Books',
  'Electronics',
  'Bags',
  'Jewelry',
  'Shoes',
  'Others',
];

const LOCATIONS = [
  'All',
  'Library',
  'Hostel Block A',
  'Hostel Block B',
  'Canteen',
  'FC',
  'Bus Stand',
  'Main Block',
  'Sports Complex',
  'Parking Area',
  'Auditorium',
  'Main Gate',
  'Other',
];

const STATUS_FILTERS = [
  'All',
  'Found',
  'Reported',
  'Matched',
  'Under Verification',
  'Recovered',
  'Escalated to Department',
  'At Admin Office',
];

const SAMPLE_PHOTOS = [
  { label: 'Wallet', url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80' },
  { label: 'Sneakers', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80' },
  { label: 'Leather Bag', url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80' },
  { label: 'ID Card', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80' },
  { label: 'Electronics', url: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=600&q=80' },
  { label: 'Keys', url: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80' },
  { label: 'Tote Bag', url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80' },
];

const SAMPLE_PHOTO_PRESETS = SAMPLE_PHOTOS;

export default function DashboardScreen() {
  const [user, setUser] = useState(storage.getUser());
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState({ found_items: 0, lost_reports: 0, recovered: 0, matched: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [sortBy, setSortBy] = useState('recent');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<number[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Active top navigation tab
  const [activeTab, setActiveTab] = useState<'home' | 'report' | 'activity' | 'notifications' | 'profile'>('home');

  // Modals & Panels
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatItem, setChatItem] = useState<Item | null>(null);
  const [geminiConfidence, setGeminiConfidence] = useState(0);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const chatModalVisible = showChat;
  const setChatModalVisible = setShowChat;
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Ownership Verification Modal
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationDetails, setVerificationDetails] = useState('');
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  // Handover to Owner Modal State
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverOwnerName, setHandoverOwnerName] = useState('');
  const [handoverOwnerRollNo, setHandoverOwnerRollNo] = useState('');
  const [handoverOwnerPhone, setHandoverOwnerPhone] = useState('');
  const [handoverOwnerDept, setHandoverOwnerDept] = useState('');
  const [handoverOwnerIdCardImage, setHandoverOwnerIdCardImage] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [submittingHandover, setSubmittingHandover] = useState(false);
  const [handoverError, setHandoverError] = useState<string | null>(null);

  // Claims Review Panel (for the Finder to see and approve/reject ownership claims)
  const [showClaimsPanel, setShowClaimsPanel] = useState(false);
  const [itemClaims, setItemClaims] = useState<Claim[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [verifyingClaimId, setVerifyingClaimId] = useState<number | null>(null);
  const [claimPanelFeedback, setClaimPanelFeedback] = useState<string | null>(null);

  // Check if current logged in user is the founder of the selected item
  const isFinderOfSelectedItem = useMemo(() => {
    if (!selectedItem || !user) return false;
    if (selectedItem.user_id && user.id && Number(selectedItem.user_id) === Number(user.id)) return true;
    if (
      selectedItem.reporter_name &&
      user.name &&
      selectedItem.reporter_name.trim().toLowerCase() === user.name.trim().toLowerCase()
    ) {
      return true;
    }
    return false;
  }, [selectedItem, user]);

  // Profile Menu
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // --- Report Lost / Found Page State ---
  const [reportType, setReportType] = useState<'lost' | 'found'>('lost');
  const [reportEntrySource, setReportEntrySource] = useState<'hero_lost' | 'hero_found' | 'navbar_plus'>('navbar_plus');
  const [reportTitle, setReportTitle] = useState('');
  const [reportCategory, setReportCategory] = useState('Wallets');
  const [reportDescription, setReportDescription] = useState('');
  const [reportLocation, setReportLocation] = useState('Library');
  const [reportCustomLocation, setReportCustomLocation] = useState('');
  const [reportDate, setReportDate] = useState('2026-09-22');
  const [reportTime, setReportTime] = useState('10:30 AM');
  const [reportIsValuable, setReportIsValuable] = useState(true);
  const [reportPrivateDetail, setReportPrivateDetail] = useState('');
  const [reportContactPref, setReportContactPref] = useState<'chat_only' | 'share_email'>('chat_only');
  const [reportPhotos, setReportPhotos] = useState<string[]>([]);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [instantMatchesFound, setInstantMatchesFound] = useState<Item[]>([]);
  const [showMatchFoundModal, setShowMatchFoundModal] = useState(false);
  const [reportSuccessToast, setReportSuccessToast] = useState<string | null>(null);

  // --- My Activity State ---
  const [activitySubTab, setActivitySubTab] = useState<'lost' | 'found' | 'matches' | 'history'>('lost');
  const [activity, setActivity] = useState<ActivityData>({
    summary_stats: { lost: 0, found: 0, active_matches: 0, recovered: 0 },
    my_lost_reports: [],
    my_found_reports: [],
    my_matches: [],
    recovered_history: [],
  });
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [historySummaryItem, setHistorySummaryItem] = useState<Item | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // --- Notifications State ---
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifFilter, setNotifFilter] = useState<'all' | 'match' | 'claim' | 'status_update'>('all');

  // --- Profile Page State ---
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [userStats, setUserStats] = useState<UserStats>({ items_reported: 0, items_recovered: 0, active_matches: 0 });
  const [isEditProfileMode, setIsEditProfileMode] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState('');
  const [profilePhoneInput, setProfilePhoneInput] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [profileContactPref, setProfileContactPref] = useState<'chat_only' | 'share_email'>('chat_only');
  const [notifyMatches, setNotifyMatches] = useState(true);
  const [notifyClaims, setNotifyClaims] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileToast, setProfileToast] = useState<string | null>(null);

  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  // Safety Guide Modal
  const [showGuideModal, setShowGuideModal] = useState(false);

  // 1. Initial Load
  useEffect(() => {
    loadDashboardData();
    loadUnreadCount();
  }, [selectedCategory, selectedLocation, sortBy]);

  // Load activity whenever user enters activity tab
  useEffect(() => {
    if (activeTab === 'activity') {
      loadActivityData();
    } else if (activeTab === 'notifications') {
      loadNotificationsData();
    } else if (activeTab === 'profile') {
      loadProfileData();
    }
  }, [activeTab]);

  // Auto-refresh: poll every 45 seconds silently (no spinner)
  useEffect(() => {
    const silentRefresh = async () => {
      try {
        const [fetchedItems, fetchedStats] = await Promise.all([
          fetchItems({ category: selectedCategory, location: selectedLocation, sort_by: sortBy }),
          fetchHomeStats().catch(() => null),
        ]);
        setItems(fetchedItems);
        if (fetchedStats) setStats(fetchedStats);
        loadUnreadCount();
        // Also refresh activity data silently if on that tab
        if (activeTab === 'activity') {
          const act = await fetchMyActivity().catch(() => null);
          if (act) setActivity(act);
        }
      } catch (_) {
        // Fail silently — no error shown for background refresh
      }
    };

    const intervalId = setInterval(silentRefresh, 45000); // every 45s
    return () => clearInterval(intervalId);
  }, [selectedCategory, selectedLocation, sortBy, activeTab]);

  // Auto-refresh: when app comes back to foreground
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // App returned to foreground — refresh everything silently
        try {
          const [fetchedItems, fetchedStats, act] = await Promise.all([
            fetchItems({ category: selectedCategory, location: selectedLocation, sort_by: sortBy }),
            fetchHomeStats().catch(() => null),
            fetchMyActivity().catch(() => null),
          ]);
          setItems(fetchedItems);
          if (fetchedStats) setStats(fetchedStats);
          if (act) setActivity(act);
          loadUnreadCount();
        } catch (_) {
          // Fail silently
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [selectedCategory, selectedLocation, sortBy]);



  // Handle Android Hardware Back Button to prevent accidental logouts
  const lastBackPressRef = useRef(0);
  useEffect(() => {
    const onBackPress = () => {
      // 1. If any modal is open, dismiss the modal first
      if (showHandoverModal) {
        setShowHandoverModal(false);
        return true;
      }
      if (showClaimsPanel) {
        setShowClaimsPanel(false);
        return true;
      }
      if (showVerificationModal) {
        setShowVerificationModal(false);
        return true;
      }
      if (showChat) {
        setShowChat(false);
        return true;
      }
      if (showMatchFoundModal) {
        setShowMatchFoundModal(false);
        return true;
      }
      if (showEditModal) {
        setShowEditModal(false);
        return true;
      }
      if (showHistoryModal) {
        setShowHistoryModal(false);
        return true;
      }
      if (showPasswordModal) {
        setShowPasswordModal(false);
        return true;
      }
      if (showGuideModal) {
        setShowGuideModal(false);
        return true;
      }
      if (selectedItem) {
        setSelectedItem(null);
        return true;
      }

      // 2. If user is in a sub-tab (notifications, activity, report, profile), go back to home!
      if (activeTab !== 'home') {
        handleTabSwitch('home');
        return true;
      }

      // 3. If on home feed with no modals open, require double-tap within 2s to exit app
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPressRef.current = now;
      if (Platform.OS === 'android') {
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      }
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [
    activeTab,
    selectedItem,
    showHandoverModal,
    showClaimsPanel,
    showVerificationModal,
    showChat,
    showMatchFoundModal,
    showEditModal,
    showHistoryModal,
    showPasswordModal,
    showGuideModal,
  ]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [fetchedItems, fetchedStats] = await Promise.all([
        fetchItems({
          category: selectedCategory,
          location: selectedLocation,
          sort_by: sortBy,
        }),
        fetchHomeStats().catch(() => ({ found_items: 0, lost_reports: 0, recovered: 0, matched: 0 })),
      ]);
      setItems(fetchedItems);
      setStats(fetchedStats);
    } catch (err) {
      console.log('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const c = await fetchUnreadCount();
      setUnreadCount(c);
    } catch (e) {
      // ignore
    }
  };

  const loadActivityData = async () => {
    try {
      const act = await fetchMyActivity();
      setActivity(act);
    } catch (err) {
      console.log('Error loading activity:', err);
    }
  };

  const loadNotificationsData = async () => {
    try {
      const list = await fetchNotifications();
      setNotifications(list);
      loadUnreadCount();
    } catch (err) {
      console.log('Error loading notifications:', err);
    }
  };

  const loadProfileData = async () => {
    try {
      const [prof, st] = await Promise.all([
        fetchUserProfile(),
        fetchUserStats(),
      ]);
      setProfileData(prof);
      setProfileNameInput(prof.name || '');
      setProfilePhoneInput(prof.phone_number || '');
      setProfileAvatarUrl(prof.avatar_url || '');
      setProfileContactPref((prof.contact_preference as any) || 'chat_only');
      setNotifyMatches(prof.notify_matches ?? true);
      setNotifyClaims(prof.notify_claims ?? true);
      setNotifyMessages(prof.notify_messages ?? true);
      setNotifyEmail(prof.notify_email ?? false);
      setUserStats(st);
    } catch (err) {
      console.log('Error loading profile:', err);
    }
  };

  // Switch tabs with optional source
  const handleTabSwitch = (tab: 'home' | 'report' | 'activity' | 'notifications' | 'profile', source?: 'hero_lost' | 'hero_found' | 'navbar_plus') => {
    if (tab === 'report') {
      if (source === 'hero_lost') {
        setReportType('lost');
        setReportEntrySource('hero_lost');
      } else if (source === 'hero_found') {
        setReportType('found');
        setReportEntrySource('hero_found');
      } else {
        setReportEntrySource('navbar_plus');
      }
    }
    setActiveTab(tab);
  };

  // Open Chat for item
  const openChatForItem = async (item: Item) => {
    setSelectedItem(item);
    setShowChat(true);
    try {
      const msgs = await fetchMessages(item.id);
      setChatMessages(msgs);
    } catch (e) {
      setChatMessages([
        {
          id: 1,
          item_id: item.id,
          sender_id: -1,
          sender_name: 'Security Bot',
          sender_role: 'system',
          message: 'Safe Handover Chat initialized. Please meet at the designated Campus Helpdesk for handovers.',
          created_at: new Date().toISOString(),
          is_system: true,
        },
      ]);
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedItem) return;
    try {
      setSendingMsg(true);
      const newMsg = await sendMessage(selectedItem.id, inputMessage.trim());
      setChatMessages((prev) => [...prev, newMsg]);
      setInputMessage('');
    } catch (e) {
      console.log('Error sending message:', e);
    } finally {
      setSendingMsg(false);
    }
  };

  // Submit claim verification (for the CLAIMER / lost item owner)
  const handleClaimSubmit = async () => {
    if (!verificationDetails.trim() || !selectedItem) return;
    try {
      setSubmittingVerification(true);
      await submitClaim(selectedItem.id, verificationDetails.trim());
      setVerificationFeedback('Claim request submitted! The finder has been notified and will review your ownership details.');
      setTimeout(() => {
        setVerificationFeedback(null);
        setShowVerificationModal(false);
        setVerificationDetails('');
      }, 2500);
    } catch (e: any) {
      setVerificationFeedback(e?.message || 'Failed to submit claim. You may have already submitted one.');
    } finally {
      setSubmittingVerification(false);
    }
  };

  // Load all claims for an item — called by the FINDER to review who is claiming
  const loadItemClaims = async (item: Item) => {
    setLoadingClaims(true);
    setClaimPanelFeedback(null);
    setItemClaims([]);
    try {
      const claims = await fetchItemClaims(item.id);
      setItemClaims(claims);
    } catch (e: any) {
      setClaimPanelFeedback(e?.message || 'Failed to load claims.');
    } finally {
      setLoadingClaims(false);
    }
  };

  // Finder approves or rejects a claim
  const handleVerifyClaim = async (claimId: number, approved: boolean) => {
    setVerifyingClaimId(claimId);
    setClaimPanelFeedback(null);
    try {
      await verifyClaim(claimId, approved);
      setClaimPanelFeedback(approved
        ? '✓ Ownership verified! Item marked as Recovered. The claimer has been notified.'
        : '✕ Claim rejected. The claimer has been notified.');
      // Update local state
      setItemClaims((prev) =>
        prev.map((c) => c.id === claimId ? { ...c, status: approved ? 'approved' : 'rejected' } : c)
      );
      if (approved) {
        setSelectedItem((prev) => prev ? { ...prev, status: 'Recovered' } : null);
        // Instantly update activity stats (optimistic)
        setActivity((prev) => ({
          ...prev,
          summary_stats: prev.summary_stats ? {
            ...prev.summary_stats,
            found: Math.max(0, (prev.summary_stats.found ?? 1) - 1),
            recovered: (prev.summary_stats.recovered ?? 0) + 1,
          } : prev.summary_stats,
        }));
        loadDashboardData();
        loadActivityData();
      }
    } catch (e: any) {
      setClaimPanelFeedback(e?.message || 'Failed to process verification.');
    } finally {
      setVerifyingClaimId(null);
    }
  };

  // Open Claims Review Panel for Finder
  const openClaimsPanelForFinder = (item: Item) => {
    setSelectedItem(item);
    setShowClaimsPanel(true);
    loadItemClaims(item);
  };

  // Handover Photo Pickers
  const handlePickHandoverIdCard = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Gallery access is needed to select the student ID card photo.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setHandoverOwnerIdCardImage(dataUri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not pick photo');
    }
  };

  const handleCaptureHandoverIdCard = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Camera access is needed to photograph the student ID card.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setHandoverOwnerIdCardImage(dataUri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not open camera');
    }
  };

  // Submit Direct Student-to-Student Handover
  const handleCompleteHandover = async () => {
    if (!selectedItem) return;
    setHandoverError(null);
    if (!handoverOwnerName.trim()) {
      setHandoverError("Please enter the owner's full name.");
      return;
    }
    if (!handoverOwnerRollNo.trim()) {
      setHandoverError("Please enter the owner's roll number.");
      return;
    }
    if (!handoverOwnerPhone.trim()) {
      setHandoverError("Please enter the owner's contact phone number.");
      return;
    }
    if (!handoverOwnerIdCardImage) {
      setHandoverError("Student ID card photo proof is strictly required.");
      return;
    }

    try {
      setSubmittingHandover(true);
      await studentDeliverToOwner(selectedItem.id, {
        owner_name: handoverOwnerName.trim(),
        owner_roll_no: handoverOwnerRollNo.trim(),
        owner_phone: handoverOwnerPhone.trim(),
        owner_department: handoverOwnerDept.trim() || undefined,
        owner_id_card_image: handoverOwnerIdCardImage,
        notes: handoverNotes.trim() || undefined,
      });

      setReportSuccessToast(`Item successfully handed over to ${handoverOwnerName.trim()}! Case closed.`);
      setSelectedItem((prev) => (prev ? { ...prev, status: 'Recovered' } : null));
      setShowHandoverModal(false);
      setShowChat(false);
      // Instantly update activity stats (optimistic)
      setActivity((prev) => ({
        ...prev,
        summary_stats: prev.summary_stats ? {
          ...prev.summary_stats,
          found: Math.max(0, (prev.summary_stats.found ?? 1) - 1),
          recovered: (prev.summary_stats.recovered ?? 0) + 1,
        } : prev.summary_stats,
      }));
      // Reset handover form
      setHandoverOwnerName('');
      setHandoverOwnerRollNo('');
      setHandoverOwnerPhone('');
      setHandoverOwnerDept('');
      setHandoverOwnerIdCardImage('');
      setHandoverNotes('');
      // Refresh items and activity from server
      loadDashboardData();
      loadActivityData();
    } catch (err: any) {
      setHandoverError(err.message || 'Failed to complete handover');
    } finally {
      setSubmittingHandover(false);
    }
  };

  // Analyze photo with AI vision parser
  const handleAnalyzePhoto = async (photoUrl: string) => {
    try {
      setAnalyzingPhoto(true);
      const res = await analyzeImageWithGemini(photoUrl);
      if (res.title) setReportTitle(res.title);
      if (res.category) setReportCategory(res.category);
      if (res.description) setReportDescription(res.description);
      if (res.is_valuable !== undefined) setReportIsValuable(res.is_valuable);
    } catch (err) {
      console.log('AI analyze error:', err);
    } finally {
      setAnalyzingPhoto(false);
    }
  };

  // Create report
  const handleCreateReport = async () => {
    if (!reportTitle.trim() || !reportDescription.trim()) {
      alert('Please provide an item title and description.');
      return;
    }

    try {
      setSubmittingReport(true);
      const finalLocation = reportLocation === 'Other' ? (reportCustomLocation.trim() || 'Campus') : reportLocation;
      const res = await createItemReport({
        title: reportTitle.trim(),
        category: reportCategory,
        description: reportDescription.trim(),
        image_url: reportPhotos[0] || '',
        location: finalLocation,
        incident_date: reportDate,
        incident_time: reportTime,
        is_valuable: reportIsValuable,
        private_verification_detail: reportPrivateDetail.trim() || undefined,
        contact_preference: reportContactPref,
        report_type: reportType,
      });

      setReportSuccessToast(`Report filed successfully! Item ID: #${res.item.id}`);

      if (reportType === 'lost' && res.matches && res.matches.length > 0) {
        setInstantMatchesFound(res.matches);
        setShowMatchFoundModal(true);
      }

      loadDashboardData();
      loadActivityData();

      setTimeout(() => {
        setReportSuccessToast(null);
        if (reportType === 'found') {
          handleTabSwitch('home');
        }
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to file report');
    } finally {
      setSubmittingReport(false);
    }
  };

  // Edit item report
  const openEditModal = (item: Item) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditLocation(item.location);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      await updateItemReport(editingItem.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        location: editLocation.trim(),
      });
      setShowEditModal(false);
      loadActivityData();
      loadDashboardData();
    } catch (e: any) {
      alert(e.message || 'Failed to update report');
    }
  };

  // Withdraw report
  const handleWithdrawItem = async (itemId: number) => {
    try {
      await withdrawItemReport(itemId);
      loadActivityData();
      loadDashboardData();
    } catch (e: any) {
      alert(e.message || 'Failed to withdraw report');
    }
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      await updateUserProfile({
        name: profileNameInput.trim(),
        phone_number: profilePhoneInput.trim(),
        contact_preference: profileContactPref,
        notify_matches: notifyMatches,
        notify_claims: notifyClaims,
        notify_messages: notifyMessages,
        notify_email: notifyEmail,
        avatar_url: profileAvatarUrl,
      });
      setIsEditProfileMode(false);
      setProfileToast('Profile preferences saved successfully.');
      setTimeout(() => setProfileToast(null), 3000);
      loadProfileData();
    } catch (err: any) {
      alert(err.message || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!currentPasswordInput || !newPasswordInput) {
      setPasswordError('Please fill all password fields.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError('New passwords do not match.');
      return;
    }
    try {
      setChangingPassword(true);
      await changePassword(currentPasswordInput, newPasswordInput);
      setShowPasswordModal(false);
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setProfileToast('Password updated successfully.');
      setTimeout(() => setProfileToast(null), 3000);
    } catch (e: any) {
      setPasswordError(e.message || 'Password update failed.');
    } finally {
      setChangingPassword(false);
    }
  };

  // Filtered Items for Home
  const filteredHomeItems = useMemo(() => {
    return items.filter((it) => {
      const matchSearch =
        it.title.toLowerCase().includes(search.toLowerCase()) ||
        it.description.toLowerCase().includes(search.toLowerCase()) ||
        it.location.toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [items, search]);

  const currentUser = user;
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
    const photoToAnalyze = reportPhotos[0] || '';
    if (!photoToAnalyze) {
      alert('Please select or enter an image first to analyze with AI.');
      return;
    }
    setAnalyzingPhoto(true);
    try {
      const result = await analyzeImageWithGemini(photoToAnalyze);
      if (result.error) {
        alert(result.error);
        return;
      }
      if (result.title) setReportTitle(result.title);
      if (result.category) setReportCategory(result.category);
      if (result.description) setReportDescription(result.description);
      if (result.is_valuable) setReportIsValuable(true);
      setGeminiConfidence(result.confidence || 0.9);
    } catch (e) {
      alert('Image analysis failed. Please fill details manually.');
    } finally {
      setAnalyzingPhoto(false);
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

  // Filtered Notifications
  const filteredNotifications = useMemo(() => {
    if (notifFilter === 'all') return notifications;
    return notifications.filter((n) => n.type === notifFilter);
  }, [notifications, notifFilter]);

  return (
    <View style={styles.outerContainer}>
      <View style={styles.phoneFrame}>
        {/* Top Floating App Bar */}
        <TopHeader
          user={{ ...user, avatar_url: profileAvatarUrl || profileData?.avatar_url || user?.avatar_url }}
          unreadCount={unreadCount}
          onNotificationsClick={() => handleTabSwitch('notifications')}
          onProfileClick={() => handleTabSwitch('profile')}
        />

        {/* Global Toast */}
        {reportSuccessToast && (
          <View style={styles.globalToastSuccess}>
            <Text style={styles.globalToastText}>{reportSuccessToast}</Text>
          </View>
        )}
        {profileToast && (
          <View style={styles.globalToastSuccess}>
            <Text style={styles.globalToastText}>{profileToast}</Text>
          </View>
        )}

        {/* Department & Admin Portals Quick Banner */}
        {(isDeptAdmin || isSuperAdmin) && (
          <View style={styles.adminBannerBar}>
            <View style={styles.adminBannerLeft}>
              <Text style={styles.adminBannerRole}>
                {isSuperAdmin ? '👑 Central Campus Administrator' : `🛡 Department Admin (${user?.department_code || 'Dept'})`}
              </Text>
              <Text style={styles.adminBannerSub}>
                Authorized personnel portal access
              </Text>
            </View>
            <View style={styles.adminBannerActions}>
              <TouchableOpacity
                style={styles.adminBannerBtn}
                onPress={() => router.push('/department')}
                activeOpacity={0.8}
              >
                <Text style={styles.adminBannerBtnText}>Dept Portal</Text>
              </TouchableOpacity>
              {isSuperAdmin && (
                <TouchableOpacity
                  style={[styles.adminBannerBtn, styles.adminBannerBtnAdmin]}
                  onPress={() => router.push('/admin')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.adminBannerBtnText}>Admin Console</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

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
                handleTabSwitch('activity');
              }}
            >
              <Text style={styles.dropdownItemText}>📋 My Reports & Claims</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownItem, styles.logoutItem]}
              onPress={() => {
                setShowProfileDropdown(false);
                storage.clearToken();
                storage.clearUser();
                router.replace('/login');
              }}
            >
              <Text style={styles.logoutItemText}>🚪 Logout</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Primary Screen Area */}
        <ScrollView style={styles.mainScrollView} showsVerticalScrollIndicator={false}>
          {activeTab === 'home' && (
            <HomeSection
              stats={stats}
              items={items}
              loading={loading}
              search={search}
              setSearch={setSearch}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              selectedLocation={selectedLocation}
              setSelectedLocation={setSelectedLocation}
              categories={CATEGORIES}
              locations={LOCATIONS}
              onSwitchTab={handleTabSwitch}
              onSelectItem={(item) => setSelectedItem(item)}
            />
          )}

          {activeTab === 'report' && (
            <ReportSection
              reportType={reportType}
              setReportType={setReportType}
              reportTitle={reportTitle}
              setReportTitle={setReportTitle}
              reportCategory={reportCategory}
              setReportCategory={setReportCategory}
              reportDescription={reportDescription}
              setReportDescription={setReportDescription}
              reportLocation={reportLocation}
              setReportLocation={setReportLocation}
              reportCustomLocation={reportCustomLocation}
              setReportCustomLocation={setReportCustomLocation}
              reportDate={reportDate}
              setReportDate={setReportDate}
              reportTime={reportTime}
              setReportTime={setReportTime}
              reportIsValuable={reportIsValuable}
              setReportIsValuable={setReportIsValuable}
              reportPrivateDetail={reportPrivateDetail}
              setReportPrivateDetail={setReportPrivateDetail}
              reportPhotos={reportPhotos}
              setReportPhotos={setReportPhotos}
              submittingReport={submittingReport}
              analyzingPhoto={analyzingPhoto}
              onAnalyzePhoto={handleAnalyzePhoto}
              onCreateReport={handleCreateReport}
              onBackToHome={() => handleTabSwitch('home')}
              categories={CATEGORIES}
              locations={LOCATIONS}
            />
          )}

          {activeTab === 'activity' && (
            <ActivitySection
              activity={activity}
              items={items}
              onBackToHome={() => handleTabSwitch('home')}
              onSwitchTab={handleTabSwitch}
              onReviewLostMatches={(item) => {
                const matched = items.filter(
                  (f) => f.category === item.category && f.report_type === 'found'
                );
                setInstantMatchesFound(matched.length > 0 ? matched : items.slice(0, 2));
                setShowMatchFoundModal(true);
              }}
              onViewItemDetail={(item) => setSelectedItem(item)}
              onEditItem={openEditModal}
              onWithdrawItem={handleWithdrawItem}
              onReviewClaims={(item) => {
                // Finder reviews ownership claims — opens the Claims Review Panel
                openClaimsPanelForFinder(item);
              }}
              onOpenMatchChat={(foundItem) => openChatForItem(foundItem)}
              onContinueMatchVerification={(foundItem) => {
                setSelectedItem(foundItem);
                setShowVerificationModal(true);
              }}
              onStaffDeskContact={(foundItem) => {
                setSelectedItem(foundItem);
                setShowGuideModal(true);
              }}
              onViewHistorySummary={(item) => {
                setHistorySummaryItem(item);
                setShowHistoryModal(true);
              }}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsSection
              notifications={notifications}
              onBackToHome={() => handleTabSwitch('home')}
              onMarkNotificationRead={async (id) => {
                await markNotificationRead(id);
                loadNotificationsData();
              }}
              onMarkAllRead={async () => {
                await markAllNotificationsRead();
                loadNotificationsData();
              }}
              onNotificationPress={(notif) => {
                if (notif.type === 'message') {
                  const targetItem = items.find((i) => i.id === notif.item_id);
                  if (targetItem) {
                    openChatForItem(targetItem);
                  } else if (notif.item_id) {
                    openChatForItem({
                      id: notif.item_id,
                      title: notif.item_title || 'Campus Item',
                      category: 'General',
                      description: '',
                      location: 'Campus Desk',
                      is_valuable: false,
                      status: 'Matched',
                      report_type: 'found',
                      reporter_name: 'Member',
                      reporter_role: 'student',
                      created_at: '',
                    });
                  }
                } else if (notif.type === 'claim') {
                  // Determine if this user is the FINDER (owns the found item) or the CLAIMER
                  const targetItem = items.find((i) => i.id === notif.item_id);
                  if (targetItem) {
                    const isFinder = user?.id && targetItem.user_id && Number(targetItem.user_id) === Number(user.id);
                    if (isFinder) {
                      // Finder: open the claims review panel to see who is claiming
                      openClaimsPanelForFinder(targetItem);
                    } else {
                      // Claimer: show the item detail so they can see status
                      setSelectedItem(targetItem);
                    }
                  } else {
                    handleTabSwitch('activity');
                    setActivitySubTab('found');
                  }
                } else if (notif.type === 'match') {
                  const targetItem = items.find((i) => i.id === notif.item_id);
                  if (targetItem) {
                    setSelectedItem(targetItem);
                  } else {
                    handleTabSwitch('activity');
                    setActivitySubTab('matches');
                  }
                } else {
                  // status_update or other
                  const targetItem = items.find((i) => i.id === notif.item_id);
                  if (targetItem) {
                    setSelectedItem(targetItem);
                  }
                }
              }}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileSection
              user={user}
              profileData={profileData}
              userStats={userStats}
              profileNameInput={profileNameInput}
              setProfileNameInput={setProfileNameInput}
              profilePhoneInput={profilePhoneInput}
              setProfilePhoneInput={setProfilePhoneInput}
              profileAvatarUrl={profileAvatarUrl}
              setProfileAvatarUrl={setProfileAvatarUrl}
              profileContactPref={profileContactPref}
              setProfileContactPref={setProfileContactPref}
              notifyMatches={notifyMatches}
              setNotifyMatches={setNotifyMatches}
              notifyClaims={notifyClaims}
              setNotifyClaims={setNotifyClaims}
              notifyMessages={notifyMessages}
              setNotifyMessages={setNotifyMessages}
              notifyEmail={notifyEmail}
              setNotifyEmail={setNotifyEmail}
              savingProfile={savingProfile}
              onSaveProfile={handleSaveProfile}
              onBackToHome={() => handleTabSwitch('home')}
              onOpenPasswordModal={() => setShowPasswordModal(true)}
              onOpenGuideModal={() => setShowGuideModal(true)}
              onSwitchToActivity={() => handleTabSwitch('activity')}
              onLogout={() => {
                storage.clearToken();
                storage.clearUser();
                router.replace('/login');
              }}
            />
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Floating Bottom Navigation Bar */}
        <BottomNavBar
          activeTab={activeTab}
          unreadCount={unreadCount}
          onTabSwitch={handleTabSwitch}
        />

        {/* ========================================================================= */}
        {/* MODAL: ITEM DETAIL SCREEN                                                 */}
        {/* ========================================================================= */}
        {selectedItem && (
          <Modal visible={true} animationType="slide" transparent={false}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.circularBackBtn}
                  onPress={() => setSelectedItem(null)}
                >
                  <Text style={styles.backBtnText}>{'<'}</Text>
                </TouchableOpacity>
                <Text style={styles.modalHeaderTitle} numberOfLines={1}>
                  {selectedItem.title}
                </Text>
                <View style={{ width: 40 }} />
              </View>

              <ScrollView style={styles.modalScrollArea} showsVerticalScrollIndicator={false}>
                <Image
                  source={{ uri: selectedItem.image_url || SAMPLE_PHOTOS[0].url }}
                  style={styles.detailHeroImage}
                />

                <View style={styles.detailContentBox}>
                  <View style={styles.detailBadgeRow}>
                    <View style={styles.categoryPillActive}>
                      <Text style={styles.categoryPillTextActive}>{selectedItem.category}</Text>
                    </View>
                    <View
                      style={[
                        styles.typeBadgePill,
                        selectedItem.report_type === 'lost' ? styles.typeBadgeLost : styles.typeBadgeFound,
                      ]}
                    >
                      <Text style={styles.typeBadgeText}>
                        {selectedItem.report_type?.toUpperCase()}
                      </Text>
                    </View>
                    {selectedItem.is_valuable && (
                      <View style={styles.highValPill}>
                        <Text style={styles.highValPillText}>SECURE HELPDESK</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.detailItemTitle}>{selectedItem.title}</Text>
                  <Text style={styles.detailMetaLine}>
                    Reported by {selectedItem.reporter_name} ({selectedItem.reporter_role}) • {selectedItem.incident_date}
                  </Text>

                  <View style={styles.detailSectionDivider} />

                  <Text style={styles.detailSectionHeading}>Location Spotted / Lost</Text>
                  <Text style={styles.detailSectionBody}>{selectedItem.location}</Text>

                  <Text style={styles.detailSectionHeading}>Description</Text>
                  <Text style={styles.detailSectionBody}>{selectedItem.description}</Text>

                  {selectedItem.is_valuable && (
                    <View style={styles.securityWarningCard}>
                      <Text style={styles.securityWarningTitle}>Department Desk Protocol</Text>
                      <Text style={styles.securityWarningBody}>
                        To prevent unauthorized claims, this item requires physical verification at the Main Campus Helpdesk.
                      </Text>
                    </View>
                  )}

                  <View style={styles.detailActionButtonsCol}>
                    {selectedItem.report_type === 'found' && (
                      isFinderOfSelectedItem ? (
                        // ── FINDER VIEW ──────────────────────────────────
                        <View style={styles.finderInfoCard}>
                          <Text style={styles.finderInfoCardTitle}>You reported finding this item</Text>
                          <Text style={styles.finderInfoCardSub}>
                            If someone claims this is their item, they will submit ownership proof. You can review all claims and approve the correct owner below.
                          </Text>
                          {selectedItem.status === 'Recovered' ? (
                            <View style={styles.recoveredSuccessBadge}>
                              <Text style={styles.recoveredSuccessBadgeText}>✓ Successfully Handed Over</Text>
                            </View>
                          ) : (
                            <>
                              <TouchableOpacity
                                style={[styles.primaryActionButtonBlack, { marginTop: 10 }]}
                                onPress={() => openClaimsPanelForFinder(selectedItem)}
                              >
                                <Text style={styles.primaryActionButtonText}>📋 Review Ownership Claims</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.secondaryOutlineBtn, { marginTop: 8 }]}
                                onPress={() => setShowHandoverModal(true)}
                              >
                                <Text style={styles.secondaryOutlineBtnText}>🤝 Proceed to Handover</Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      ) : (
                        // ── CLAIMER / LOST OWNER VIEW ─────────────────────
                        selectedItem.status !== 'Recovered' && (
                          <TouchableOpacity
                            style={styles.primaryActionButtonBlack}
                            onPress={() => setShowVerificationModal(true)}
                          >
                            <Text style={styles.primaryActionButtonText}>📝 Claim This Item — This is Mine</Text>
                          </TouchableOpacity>
                        )
                      )
                    )}

                    <TouchableOpacity
                      style={styles.secondaryOutlineBtn}
                      onPress={() => openChatForItem(selectedItem)}
                    >
                      <Text style={styles.secondaryOutlineBtnText}>
                        {isFinderOfSelectedItem ? '💬 Open Chat with Claimant' : '💬 Contact / Chat with Finder'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </Modal>
        )}

        {/* ========================================================================= */}
        {/* MODAL: CLAIMS REVIEW PANEL (FINDER sees and approves/rejects claims)       */}
        {/* ========================================================================= */}
        {showClaimsPanel && selectedItem && (
          <Modal visible={true} animationType="slide" transparent={false}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TouchableOpacity style={styles.circularBackBtn} onPress={() => setShowClaimsPanel(false)}>
                  <Text style={styles.backBtnText}>{'<'}</Text>
                </TouchableOpacity>
                <Text style={styles.modalHeaderTitle} numberOfLines={1}>Ownership Claims</Text>
                <View style={{ width: 40 }} />
              </View>

              <ScrollView style={styles.modalScrollArea} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
                <Text style={[styles.detailSectionHeading, { marginBottom: 4 }]}>{selectedItem.title}</Text>
                <Text style={styles.detailMetaLine}>Review who is claiming this item. Check their details and approve the rightful owner.</Text>

                {claimPanelFeedback && (
                  <View style={[
                    styles.securityWarningCard,
                    claimPanelFeedback.startsWith('✓') ? { backgroundColor: '#d1fae5', borderColor: '#10B981' } : {},
                    claimPanelFeedback.startsWith('✕') ? { backgroundColor: '#fee2e2', borderColor: '#EF4444' } : {},
                  ]}>
                    <Text style={[styles.securityWarningBody, { color: '#111' }]}>{claimPanelFeedback}</Text>
                  </View>
                )}

                {loadingClaims ? (
                  <ActivityIndicator size="large" color="#111" style={{ marginTop: 40 }} />
                ) : itemClaims.length === 0 ? (
                  <View style={styles.finderInfoCard}>
                    <Text style={styles.finderInfoCardTitle}>No claims yet</Text>
                    <Text style={styles.finderInfoCardSub}>
                      No one has submitted an ownership claim for this item yet. When someone claims it, their verification details will appear here.
                    </Text>
                  </View>
                ) : (
                  itemClaims.map((claim) => (
                    <View key={claim.id} style={[
                      styles.claimReviewCard,
                      claim.status === 'approved' ? { borderColor: '#10B981', backgroundColor: '#f0fdf4' } : {},
                      claim.status === 'rejected' ? { borderColor: '#EF4444', backgroundColor: '#fef2f2' } : {},
                    ]}>
                      <View style={styles.claimReviewHeader}>
                        <Text style={styles.claimReviewName}>{claim.claimant_name}</Text>
                        <View style={[
                          styles.claimStatusBadge,
                          claim.status === 'pending' ? { backgroundColor: '#FEF3C7' } : {},
                          claim.status === 'approved' ? { backgroundColor: '#D1FAE5' } : {},
                          claim.status === 'rejected' ? { backgroundColor: '#FEE2E2' } : {},
                        ]}>
                          <Text style={[
                            styles.claimStatusBadgeText,
                            claim.status === 'pending' ? { color: '#92400E' } : {},
                            claim.status === 'approved' ? { color: '#065F46' } : {},
                            claim.status === 'rejected' ? { color: '#991B1B' } : {},
                          ]}>
                            {claim.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.claimReviewRole}>{claim.claimant_role}</Text>

                      <Text style={styles.claimOwnershipLabel}>Ownership Proof Provided:</Text>
                      <View style={styles.claimOwnershipBox}>
                        <Text style={styles.claimOwnershipText}>{claim.hidden_details}</Text>
                      </View>

                      <Text style={styles.claimReviewMeta}>Submitted: {new Date(claim.created_at).toLocaleDateString()}</Text>

                      {claim.status === 'pending' && selectedItem.status !== 'Recovered' && (
                        <View style={styles.claimActionRow}>
                          <TouchableOpacity
                            style={[styles.claimApproveBtn, verifyingClaimId === claim.id && { opacity: 0.6 }]}
                            onPress={() => handleVerifyClaim(claim.id, true)}
                            disabled={verifyingClaimId !== null}
                          >
                            {verifyingClaimId === claim.id ? (
                              <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                              <Text style={styles.claimApproveBtnText}>✓ Approve — This is the owner</Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.claimRejectBtn, verifyingClaimId === claim.id && { opacity: 0.6 }]}
                            onPress={() => handleVerifyClaim(claim.id, false)}
                            disabled={verifyingClaimId !== null}
                          >
                            <Text style={styles.claimRejectBtnText}>✕ Reject</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ))
                )}

                <TouchableOpacity
                  style={[styles.secondaryOutlineBtn, { marginTop: 24 }]}
                  onPress={() => {
                    setShowClaimsPanel(false);
                    setShowHandoverModal(true);
                  }}
                >
                  <Text style={styles.secondaryOutlineBtnText}>🤝 Proceed to Handover</Text>
                </TouchableOpacity>
                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </Modal>
        )}

        {/* ========================================================================= */}
        {/* MODAL: VERIFICATION / CLAIM SUBMISSION (CLAIMER / lost owner fills this)  */}
        {/* ========================================================================= */}
        {showVerificationModal && selectedItem && (
          <Modal visible={true} animationType="slide" transparent={true}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCardPopup}>
                <View style={styles.modalPopupHeader}>
                  <Text style={styles.modalPopupTitle}>Prove Ownership</Text>
                  <TouchableOpacity onPress={() => setShowVerificationModal(false)}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalPopupSub}>
                  Describe unique details about this item that only the true owner would know — e.g. scratch marks, contents, name on item, lock code.
                  The finder will review and confirm.
                </Text>

                <TextInput
                  style={[styles.textInputField, { height: 110, textAlignVertical: 'top' }]}
                  placeholder="e.g. Inside the wallet there is a blue bus pass and ₹150 cash. There's a small tear on the left side..."
                  placeholderTextColor="#8E8E93"
                  multiline
                  value={verificationDetails}
                  onChangeText={setVerificationDetails}
                />

                {verificationFeedback && (
                  <Text style={styles.feedbackAlertText}>{verificationFeedback}</Text>
                )}

                <TouchableOpacity
                  style={[styles.primaryActionButtonBlack, { marginTop: 14 }]}
                  onPress={handleClaimSubmit}
                  disabled={submittingVerification}
                >
                  {submittingVerification ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.primaryActionButtonText}>📤 Send Claim to Finder</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

        {/* ========================================================================= */}
        {/* MODAL: DIRECT CHAT                                                        */}
        {/* ========================================================================= */}
        {showChat && selectedItem && (
          <Modal visible={true} animationType="slide" transparent={false}>
            <KeyboardAvoidingView
              style={styles.chatModalContainer}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={styles.chatHeader}>
                <TouchableOpacity
                  style={styles.circularBackBtn}
                  onPress={() => setShowChat(false)}
                >
                  <Text style={styles.backBtnText}>{'<'}</Text>
                </TouchableOpacity>
                <View style={styles.chatHeaderInfo}>
                  <Text style={styles.chatHeaderName} numberOfLines={1}>{selectedItem.title}</Text>
                  <Text style={styles.chatHeaderStatus}>Peer Handover Coordination • Online</Text>
                </View>
                {isFinderOfSelectedItem && selectedItem.status !== 'Recovered' ? (
                  <TouchableOpacity
                    style={styles.chatHeaderHandoverBtn}
                    onPress={() => setShowHandoverModal(true)}
                  >
                    <Text style={styles.chatHeaderHandoverBtnText}>🤝 Handover</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 40 }} />
                )}
              </View>

              <ScrollView style={styles.chatMessageScroll} contentContainerStyle={{ padding: 16 }}>
                {chatMessages.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  if (msg.is_system) {
                    return (
                      <View key={msg.id} style={styles.systemChatNotice}>
                        <Text style={styles.systemChatNoticeText}>{msg.message}</Text>
                      </View>
                    );
                  }
                  return (
                    <View
                      key={msg.id}
                      style={[styles.chatBubbleWrapper, isMe ? styles.chatBubbleRight : styles.chatBubbleLeft]}
                    >
                      <View style={[styles.chatBubble, isMe ? styles.chatBubbleMe : styles.chatBubbleOther]}>
                        <Text style={[styles.chatBubbleText, isMe ? styles.chatBubbleTextMe : styles.chatBubbleTextOther]}>
                          {msg.message}
                        </Text>
                      </View>
                      <Text style={styles.chatBubbleTime}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>

              <View style={styles.chatInputBar}>
                <TextInput
                  style={styles.chatTextInput}
                  placeholder="Type handover details or place..."
                  placeholderTextColor="#8E8E93"
                  value={inputMessage}
                  onChangeText={setInputMessage}
                />
                <TouchableOpacity
                  style={[styles.chatSendBtn, !inputMessage.trim() && styles.chatSendBtnDisabled]}
                  onPress={handleSendMessage}
                  disabled={!inputMessage.trim() || sendingMsg}
                >
                  <Text style={styles.chatSendBtnText}>↑</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        )}

        {/* ========================================================================= */}
        {/* MODAL: INSTANT AUTO-MATCH NOTIFICATION                                    */}
        {/* ========================================================================= */}
        {showMatchFoundModal && (
          <Modal visible={true} animationType="fade" transparent={true}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCardPopup}>
                <View style={styles.modalPopupHeader}>
                  <Text style={styles.modalPopupTitle}>Potential Matches Detected</Text>
                  <TouchableOpacity onPress={() => setShowMatchFoundModal(false)}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalPopupSub}>
                  The system detected candidate belongings matching your report's category and location.
                </Text>

                <ScrollView style={{ maxHeight: 240, marginVertical: 10 }}>
                  {instantMatchesFound.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.matchItemCandidateRow}
                      onPress={() => {
                        setShowMatchFoundModal(false);
                        setSelectedItem(m);
                      }}
                    >
                      <Image source={{ uri: m.image_url || SAMPLE_PHOTOS[0].url }} style={styles.matchCandidateThumb} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.matchCandidateTitle} numberOfLines={1}>{m.title}</Text>
                        <Text style={styles.matchCandidateLoc}>{m.location} • {m.incident_date}</Text>
                      </View>
                      <Text style={styles.matchCandidateArrow}>→</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={styles.primaryActionButtonBlack}
                  onPress={() => {
                    setShowMatchFoundModal(false);
                    handleTabSwitch('activity');
                    setActivitySubTab('matches');
                  }}
                >
                  <Text style={styles.primaryActionButtonText}>Open Matches Queue</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

        {/* ========================================================================= */}
        {/* MODAL: EDIT REPORT                                                        */}
        {/* ========================================================================= */}
        {showEditModal && editingItem && (
          <Modal visible={true} animationType="slide" transparent={true}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCardPopup}>
                <View style={styles.modalPopupHeader}>
                  <Text style={styles.modalPopupTitle}>Edit Report Details</Text>
                  <TouchableOpacity onPress={() => setShowEditModal(false)}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabelSmall}>Item Title</Text>
                <TextInput
                  style={styles.textInputField}
                  value={editTitle}
                  onChangeText={setEditTitle}
                />

                <Text style={[styles.fieldLabelSmall, { marginTop: 8 }]}>Location</Text>
                <TextInput
                  style={styles.textInputField}
                  value={editLocation}
                  onChangeText={setEditLocation}
                />

                <Text style={[styles.fieldLabelSmall, { marginTop: 8 }]}>Description</Text>
                <TextInput
                  style={[styles.textInputField, { height: 70, textAlignVertical: 'top' }]}
                  multiline
                  value={editDescription}
                  onChangeText={setEditDescription}
                />

                <TouchableOpacity
                  style={[styles.primaryActionButtonBlack, { marginTop: 14 }]}
                  onPress={handleSaveEdit}
                >
                  <Text style={styles.primaryActionButtonText}>Save Corrections</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

        {/* ========================================================================= */}
        {/* MODAL: RECOVERED SUMMARY TIMELINE                                         */}
        {/* ========================================================================= */}
        {showHistoryModal && historySummaryItem && (
          <Modal visible={true} animationType="slide" transparent={true}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCardPopup}>
                <View style={styles.modalPopupHeader}>
                  <Text style={styles.modalPopupTitle}>Recovery Timeline</Text>
                  <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.summaryItemTitle}>{historySummaryItem.title}</Text>
                <Text style={styles.summaryItemSub}>{historySummaryItem.category} • {historySummaryItem.location}</Text>

                <View style={styles.timelineContainer}>
                  <View style={styles.timelineRow}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineTitle}>1. Reported</Text>
                      <Text style={styles.timelineDesc}>Filed by {historySummaryItem.reporter_name} on {historySummaryItem.incident_date}</Text>
                    </View>
                  </View>

                  <View style={styles.timelineLine} />

                  <View style={styles.timelineRow}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineTitle}>2. Matched & Linked</Text>
                      <Text style={styles.timelineDesc}>Auto-matched with corresponding report</Text>
                    </View>
                  </View>

                  <View style={styles.timelineLine} />

                  <View style={styles.timelineRow}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineTitle}>3. Ownership Verified</Text>
                      <Text style={styles.timelineDesc}>Unique identifiers verified by finder / staff desk</Text>
                    </View>
                  </View>

                  <View style={styles.timelineLine} />

                  <View style={styles.timelineRow}>
                    <View style={[styles.timelineDot, styles.dotGreen]} />
                    <View style={styles.timelineContent}>
                      <Text style={[styles.timelineTitle, { color: '#10B981' }]}>4. Recovered & Handed Over</Text>
                      <Text style={styles.timelineDesc}>Successfully returned to rightful owner. Case closed.</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryActionButtonBlack, { marginTop: 14 }]}
                  onPress={() => setShowHistoryModal(false)}
                >
                  <Text style={styles.primaryActionButtonText}>Close Summary</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

        {/* ========================================================================= */}
        {/* MODAL: CHANGE PASSWORD                                                    */}
        {/* ========================================================================= */}
        {showPasswordModal && (
          <Modal visible={true} animationType="slide" transparent={true}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCardPopup}>
                <View style={styles.modalPopupHeader}>
                  <Text style={styles.modalPopupTitle}>Change Password</Text>
                  <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {passwordError && (
                  <Text style={styles.passwordErrorText}>{passwordError}</Text>
                )}

                <Text style={styles.fieldLabelSmall}>Current Password</Text>
                <TextInput
                  style={styles.textInputField}
                  secureTextEntry
                  value={currentPasswordInput}
                  onChangeText={setCurrentPasswordInput}
                />

                <Text style={[styles.fieldLabelSmall, { marginTop: 8 }]}>New Password</Text>
                <TextInput
                  style={styles.textInputField}
                  secureTextEntry
                  value={newPasswordInput}
                  onChangeText={setNewPasswordInput}
                />

                <Text style={[styles.fieldLabelSmall, { marginTop: 8 }]}>Confirm New Password</Text>
                <TextInput
                  style={styles.textInputField}
                  secureTextEntry
                  value={confirmPasswordInput}
                  onChangeText={setConfirmPasswordInput}
                />

                <TouchableOpacity
                  style={[styles.primaryActionButtonBlack, { marginTop: 14 }]}
                  onPress={handleChangePassword}
                  disabled={changingPassword}
                >
                  {changingPassword ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.primaryActionButtonText}>Update Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

        {/* ========================================================================= */}
        {/* MODAL: HANDOVER SAFETY GUIDE                                              */}
        {/* ========================================================================= */}
        {showGuideModal && (
          <Modal visible={true} animationType="slide" transparent={true}>
            <View style={styles.modalBackdrop}>
              <View style={[styles.modalCardPopup, { maxHeight: 520 }]}>
                <View style={styles.modalPopupHeader}>
                  <Text style={styles.modalPopupTitle}>Handover Safety Protocol</Text>
                  <TouchableOpacity onPress={() => setShowGuideModal(false)}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ marginVertical: 8 }}>
                  <Text style={styles.guideHeading}>1. Public Handover Points</Text>
                  <Text style={styles.guideText}>
                    Always meet in well-lit public campus locations like Central Library Helpdesk, Admin Block Lobby, or Main Canteen.
                  </Text>

                  <Text style={styles.guideHeading}>2. Ownership Verification</Text>
                  <Text style={styles.guideText}>
                    Ask the claimant to unlock electronic items or describe concealed identifying stickers before handing over the item.
                  </Text>

                  <Text style={styles.guideHeading}>3. High-Value Items</Text>
                  <Text style={styles.guideText}>
                    Wallets, smartphones, laptops, and smart ID cards should be handed over via the Department Staff Desk for logged verification.
                  </Text>
                </ScrollView>

                <TouchableOpacity
                  style={styles.primaryActionButtonBlack}
                  onPress={() => setShowGuideModal(false)}
                >
                  <Text style={styles.primaryActionButtonText}>Understood</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

        {/* ========================================================================= */}
        {/* MODAL: DIRECT STUDENT HANDOVER TO OWNER                                   */}
        {/* ========================================================================= */}
        {showHandoverModal && selectedItem && (
          <Modal visible={true} animationType="slide" transparent={true}>
            <View style={styles.modalBackdrop}>
              <View style={[styles.modalCardPopup, { maxHeight: '90%' }]}>
                <View style={styles.modalPopupHeader}>
                  <Text style={styles.modalPopupTitle}>Handover Item to Owner</Text>
                  <TouchableOpacity onPress={() => setShowHandoverModal(false)}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                  <Text style={styles.modalPopupSub}>
                    Record the owner's identity and capture their Kongu Student ID card photo to safely close this recovery.
                  </Text>

                  {handoverError && (
                    <View style={styles.handoverErrorBox}>
                      <Text style={styles.handoverErrorText}>{handoverError}</Text>
                    </View>
                  )}

                  <Text style={styles.handoverFieldLabel}>Owner Full Name *</Text>
                  <TextInput
                    style={styles.handoverInput}
                    placeholder="e.g. Karthik S"
                    placeholderTextColor="#8E8E93"
                    value={handoverOwnerName}
                    onChangeText={setHandoverOwnerName}
                  />

                  <Text style={styles.handoverFieldLabel}>Roll Number *</Text>
                  <TextInput
                    style={styles.handoverInput}
                    placeholder="e.g. 22ITR045"
                    placeholderTextColor="#8E8E93"
                    autoCapitalize="characters"
                    value={handoverOwnerRollNo}
                    onChangeText={setHandoverOwnerRollNo}
                  />

                  <Text style={styles.handoverFieldLabel}>Phone Number *</Text>
                  <TextInput
                    style={styles.handoverInput}
                    placeholder="e.g. 9876543210"
                    placeholderTextColor="#8E8E93"
                    keyboardType="phone-pad"
                    value={handoverOwnerPhone}
                    onChangeText={setHandoverOwnerPhone}
                  />

                  <Text style={styles.handoverFieldLabel}>Department</Text>
                  <TextInput
                    style={styles.handoverInput}
                    placeholder="e.g. Information Technology (IT)"
                    placeholderTextColor="#8E8E93"
                    value={handoverOwnerDept}
                    onChangeText={setHandoverOwnerDept}
                  />

                  <Text style={styles.handoverFieldLabel}>Owner Student ID Card Photo *</Text>
                  <Text style={styles.handoverHelperText}>
                    Required verification proof: Photo of claimant's student ID card.
                  </Text>

                  {handoverOwnerIdCardImage ? (
                    <View style={styles.handoverIdPreviewBox}>
                      <Image source={{ uri: handoverOwnerIdCardImage }} style={styles.handoverIdPreviewImg} />
                      <View style={styles.handoverIdPreviewActions}>
                        <TouchableOpacity
                          style={styles.handoverChangePhotoBtn}
                          onPress={handleCaptureHandoverIdCard}
                        >
                          <Text style={styles.handoverChangePhotoText}>Retake Photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.handoverRemovePhotoBtn}
                          onPress={() => setHandoverOwnerIdCardImage('')}
                        >
                          <Text style={styles.handoverRemovePhotoText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.handoverPhotoBtnRow}>
                      <TouchableOpacity
                        style={styles.handoverCameraBtn}
                        onPress={handleCaptureHandoverIdCard}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.handoverCameraBtnText}>📷 Camera</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.handoverGalleryBtn}
                        onPress={handlePickHandoverIdCard}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.handoverGalleryBtnText}>Choose from Gallery</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text style={styles.handoverFieldLabel}>Handover Location / Notes</Text>
                  <TextInput
                    style={[styles.handoverInput, { height: 60, textAlignVertical: 'top' }]}
                    placeholder="e.g. Handed over at Central Library ground floor"
                    placeholderTextColor="#8E8E93"
                    multiline
                    value={handoverNotes}
                    onChangeText={setHandoverNotes}
                  />

                  <TouchableOpacity
                    style={[styles.primaryActionButtonBlack, { marginTop: 14 }]}
                    onPress={handleCompleteHandover}
                    disabled={submittingHandover}
                  >
                    {submittingHandover ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.primaryActionButtonText}>Confirm & Complete Handover</Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? '#0F0F11' : '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Platform.OS === 'web' ? 16 : 0,
  },
  phoneFrame: {
    width: Platform.OS === 'web' ? 412 : '100%',
    height: Platform.OS === 'web' ? 840 : '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: Platform.OS === 'web' ? 36 : 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
    position: 'relative',
  },
  mainScrollView: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },

  // App Bar
  appHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandSquareMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandSquareMarkText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
  brandTitleText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#111111',
  },
  brandSubTitleText: {
    fontSize: 10,
    color: '#8E8E93',
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
    backgroundColor: '#111',
  },
  bellBaseBar: {
    width: 15,
    height: 2,
    backgroundColor: '#111',
    marginTop: 1,
  },
  bellClapper: {
    width: 4,
    height: 2,
    backgroundColor: '#111',
    borderRadius: 1,
    marginTop: 1,
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  headerAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminBannerBar: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  adminBannerLeft: {
    flex: 1,
    marginRight: 10,
  },
  adminBannerRole: {
    color: '#F9FAFB',
    fontSize: 12.5,
    fontWeight: '700',
  },
  adminBannerSub: {
    color: '#9CA3AF',
    fontSize: 10.5,
  },
  adminBannerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  adminBannerBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  adminBannerBtnAdmin: {
    backgroundColor: '#D97706',
  },
  adminBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  profileDropdown: {
    position: 'absolute',
    top: 55,
    right: 16,
    width: 250,
    backgroundColor: '#ffffff',
    borderRadius: 16,
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
  headerSearchInput: {
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
  },
  headerAvatarText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // Toasts
  globalToastSuccess: {
    position: 'absolute',
    top: 55,
    left: 20,
    right: 20,
    zIndex: 99,
    backgroundColor: '#111',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  globalToastText: {
    color: '#FFF',
    fontSize: 12.5,
    fontWeight: '600',
  },

  // Hero Section
  heroCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#000000',
    borderRadius: 20,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heroLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  heroLivePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  heroDateText: {
    color: '#8E8E93',
    fontSize: 11,
  },
  heroHeadline: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 6,
  },
  heroSubtext: {
    color: '#C7C7CC',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  heroActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroLostButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  heroLostButtonText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 12.5,
  },
  heroFoundButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  heroFoundButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12.5,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  statNumber: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
  },
  statLabel: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 2,
    textAlign: 'center',
  },

  // Search
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  searchIconSymbol: {
    width: 14,
    height: 14,
    marginRight: 8,
    position: 'relative',
  },
  searchGlassCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#8E8E93',
  },
  searchGlassHandle: {
    position: 'absolute',
    width: 5,
    height: 1.5,
    backgroundColor: '#8E8E93',
    bottom: 0,
    right: 0,
    transform: [{ rotate: '45deg' }],
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#111',
  },
  searchClearGlyph: {
    color: '#8E8E93',
    fontSize: 13,
    padding: 4,
  },

  // Categories & Locations
  categoryScrollList: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  categoryPillActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },

  locationScrollList: {
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 14,
  },
  locationChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  locationChipActive: {
    backgroundColor: '#E5E5EA',
  },
  locationChipText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  locationChipTextActive: {
    color: '#000',
    fontWeight: '700',
  },

  // Feed Header
  feedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  feedHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  feedHeaderCount: {
    fontSize: 12,
    color: '#8E8E93',
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
  legacyItemCardLocation: {
    fontSize: 11,
    color: '#374151',
    marginTop: 6,
  },
  itemCardTime: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  legacyItemCardFooter: {
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

  // Items Feed
  feedLoadingBox: {
    padding: 30,
    alignItems: 'center',
  },
  feedLoadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyFeedBox: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  emptyFeedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyFeedSub: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 12,
  },
  itemsGrid: {
    paddingHorizontal: 16,
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  itemCardImageWrapper: {
    width: '100%',
    height: 150,
    backgroundColor: '#F2F2F7',
    position: 'relative',
  },
  itemCardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  itemCardPillsContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    gap: 6,
  },
  typeBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeLost: {
    backgroundColor: '#000000',
  },
  typeBadgeFound: {
    backgroundColor: '#10B981',
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  highValPill: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  highValPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  itemCardBody: {
    padding: 12,
  },
  itemCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 2,
  },
  itemCardLocation: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 6,
  },
  itemCardSnippet: {
    fontSize: 12,
    color: '#555555',
    lineHeight: 16,
    marginBottom: 10,
  },
  itemCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  statusIndicatorWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotGreen: { backgroundColor: '#10B981' },
  dotAmber: { backgroundColor: '#F59E0B' },
  dotBlue: { backgroundColor: '#3B82F6' },
  dotRed: { backgroundColor: '#EF4444' },
  statusTextLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  cardDetailBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
  },
  cardDetailBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
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

  // ==========================================
  // REPORT PAGE STYLES
  // ==========================================
  reportPageWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  reportTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  reportBackCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnArrowText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
  },
  reportScreenTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
  },
  reportTypeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  reportTypeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  reportTypeTabActive: {
    backgroundColor: '#000',
  },
  reportTypeTabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#666',
  },
  reportTypeTabTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  formSectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  sectionHeading: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#111',
    marginBottom: 2,
  },
  sectionHelperText: {
    fontSize: 11.5,
    color: '#8E8E93',
    lineHeight: 15,
  },
  samplePhotoThumbWrapper: {
    width: 70,
    height: 70,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  samplePhotoThumbSelected: {
    borderColor: '#000',
  },
  samplePhotoThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  samplePhotoThumbLabel: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#FFF',
    fontSize: 9,
    textAlign: 'center',
    borderRadius: 4,
  },
  aiAnalyzingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 8,
    borderRadius: 10,
    gap: 8,
    marginTop: 6,
  },
  aiAnalyzingPillText: {
    fontSize: 11.5,
    color: '#111',
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  textInputField: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111',
  },
  categoryChoiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    marginRight: 6,
  },
  categoryChoiceChipActive: {
    backgroundColor: '#000',
  },
  categoryChoiceChipText: {
    fontSize: 11.5,
    color: '#666',
    fontWeight: '600',
  },
  categoryChoiceChipTextActive: {
    color: '#FFF',
  },
  valuableToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  valuableCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#8E8E93',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuableCheckboxChecked: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  valuableCheckmark: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  valuableLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#111',
  },
  valuableHelper: {
    fontSize: 10.5,
    color: '#8E8E93',
  },
  submitReportLargeBtn: {
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginVertical: 10,
  },
  submitReportLargeBtnDisabled: {
    backgroundColor: '#8E8E93',
  },
  submitReportLargeBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // ==========================================
  // MY ACTIVITY (CLEAN SPECIFICATION STYLES)
  // ==========================================
  activityPageWrapperClean: {
    flex: 1,
    paddingHorizontal: 16,
  },
  activityTopBarClean: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  backBtnArrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrowGlyph: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  activityScreenTitleClean: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
  },

  // Section 2: Summary Stats Strip
  activityStatsStripClean: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  statMiniCardClean: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  statMiniNumClean: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
  },
  statMiniLabelClean: {
    fontSize: 9.5,
    color: '#8E8E93',
    marginTop: 2,
    textAlign: 'center',
  },

  // Section 3: 4 Tab Navigation Pills
  activityTabsScrollRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    paddingVertical: 2,
  },
  activityTabPillClean: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
  },
  activityTabPillActiveClean: {
    backgroundColor: '#000000',
  },
  activityTabTextClean: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  activityTabTextActiveClean: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  tabContentContainer: {
    gap: 12,
    paddingBottom: 20,
  },

  // Clean Activity Item Card
  activityItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  itemThumbRect: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  thumbDimmed: {
    opacity: 0.75,
  },
  cardHeaderDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  cardItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 4,
  },
  statusBadgeWithDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  coloredStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#444444',
  },
  cardLocationDate: {
    fontSize: 11,
    color: '#8E8E93',
  },

  // Indicators
  matchIndicatorRow: {
    marginTop: 10,
  },
  matchCountPillAmber: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  matchCountTextAmber: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
  },
  matchCountPillMuted: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  matchCountTextMuted: {
    color: '#8E8E93',
    fontSize: 11,
  },
  claimCountPillAmber: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  claimCountTextAmber: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '700',
  },
  claimCountPillGray: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  claimCountTextGray: {
    color: '#8E8E93',
    fontSize: 11,
  },

  // Card Actions Footer
  cardActionsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  primaryReviewBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  primaryReviewBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryOutlineBtn: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  secondaryOutlineBtnText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '700',
  },
  miniActionIconsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  iconActionCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyphDark: {
    fontSize: 14,
    color: '#111',
  },
  iconGlyphDanger: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '800',
  },

  // Working Queue / Matches Cards
  matchQueueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  matchQueueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  similarityScoreBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  similarityScoreText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '800',
  },
  stageIndicatorBadge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stageIndicatorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#444',
  },
  sideBySideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
  },
  sideItemColumn: {
    flex: 1,
    alignItems: 'center',
  },
  sideItemThumb: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#E5E5EA',
    marginBottom: 4,
  },
  sideItemBadgeLost: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#EF4444',
    marginBottom: 2,
  },
  sideItemBadgeFound: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 2,
  },
  sideItemTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  sideItemLoc: {
    fontSize: 10,
    color: '#8E8E93',
    textAlign: 'center',
  },
  sideItemArrowCol: {
    paddingHorizontal: 8,
  },
  sideItemArrowText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#8E8E93',
  },
  staffCustodyNoticeBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  staffCustodyNoticeHeading: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#B45309',
    marginBottom: 2,
  },
  staffCustodyNoticeDesc: {
    fontSize: 10.5,
    color: '#78350F',
    lineHeight: 14,
  },
  matchCardFooter: {
    marginTop: 6,
  },

  // Recovered History Cards
  historyItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    opacity: 0.95,
  },
  historyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  recoveredClosedBadge: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recoveredClosedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#666',
  },
  historyOriginText: {
    fontSize: 11,
    color: '#8E8E93',
  },
  historyMatchedWithText: {
    fontSize: 11,
    color: '#555',
    marginTop: 2,
  },
  historyCardFooter: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    alignItems: 'flex-start',
  },
  viewSummaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
  },
  viewSummaryButtonText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#111',
  },

  // ==========================================
  // FLOATING BOTTOM CAPSULE NAVBAR
  // ==========================================
  floatingNavWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 16 : 24,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  floatingCapsuleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  floatingTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  floatingTabItemActivePill: {
    backgroundColor: '#000000',
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
    fontSize: 12,
    fontWeight: '700',
  },
  shapeActiveWhite: {
    backgroundColor: '#FFFFFF',
  },
  centerAddButtonDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  centerAddButtonDiscActive: {
    backgroundColor: '#333333',
  },
  centerAddPlusGlyph: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 28,
  },

  // Vector shapes for nav icons
  houseRoofShape: {
    width: 14,
    height: 7,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    backgroundColor: '#666',
  },
  houseBaseShape: {
    width: 12,
    height: 8,
    backgroundColor: '#666',
    marginTop: 1,
  },
  tasksRectShape: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: '#666',
    borderRadius: 3,
  },
  tasksLineShape: {
    position: 'absolute',
    width: 8,
    height: 1.5,
    backgroundColor: '#666',
  },
  bellNavShape: {
    width: 12,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#666',
  },
  navUnreadRedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  userHeadCircle: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#666',
    marginBottom: 2,
  },
  userBodyArc: {
    width: 13,
    height: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: '#666',
  },

  // Modals & Popups
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  circularBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: -1,
  },
  modalHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111',
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  modalScrollArea: {
    flex: 1,
  },
  detailHeroImage: {
    width: '100%',
    height: 240,
    backgroundColor: '#F2F2F7',
    resizeMode: 'cover',
  },
  detailContentBox: {
    padding: 16,
  },
  detailBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  detailItemTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111',
    marginBottom: 4,
  },
  detailMetaLine: {
    fontSize: 12,
    color: '#8E8E93',
  },
  detailSectionDivider: {
    height: 1,
    backgroundColor: '#F2F2F7',
    marginVertical: 14,
  },
  detailSectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111',
    marginBottom: 4,
    marginTop: 8,
  },
  detailSectionBody: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  securityWarningCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginVertical: 14,
  },
  securityWarningTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#B45309',
    marginBottom: 2,
  },
  securityWarningBody: {
    fontSize: 11.5,
    color: '#78350F',
    lineHeight: 16,
  },
  detailActionButtonsCol: {
    marginTop: 20,
    gap: 10,
  },
  primaryActionButtonBlack: {
    backgroundColor: '#000',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryActionButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // Modal Backdrop & Popups
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCardPopup: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
  },
  modalPopupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalPopupTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '700',
    padding: 4,
  },
  modalPopupSub: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
    marginBottom: 12,
  },
  feedbackAlertText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '700',
    marginTop: 8,
  },

  // Chat
  chatModalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  chatHeaderInfo: {
    flex: 1,
    alignItems: 'center',
  },
  chatHeaderName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111',
  },
  chatHeaderStatus: {
    fontSize: 10,
    color: '#10B981',
  },
  chatMessageScroll: {
    flex: 1,
  },
  systemChatNotice: {
    backgroundColor: '#E5E5EA',
    borderRadius: 12,
    padding: 8,
    marginVertical: 10,
    alignItems: 'center',
  },
  systemChatNoticeText: {
    fontSize: 11.5,
    color: '#444',
    textAlign: 'center',
  },
  chatBubbleWrapper: {
    marginBottom: 10,
    maxWidth: '78%',
  },
  chatBubbleLeft: {
    alignSelf: 'flex-start',
  },
  chatBubbleRight: {
    alignSelf: 'flex-end',
  },
  chatBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chatBubbleMe: {
    backgroundColor: '#000',
    borderBottomRightRadius: 4,
  },
  chatBubbleOther: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  chatBubbleText: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  chatBubbleTextMe: {
    color: '#FFF',
  },
  chatBubbleTextOther: {
    color: '#111',
  },
  chatBubbleTime: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 3,
    marginHorizontal: 4,
  },
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13.5,
    color: '#111',
    maxHeight: 80,
  },
  chatSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  chatSendBtnDisabled: {
    backgroundColor: '#C7C7CC',
  },
  chatSendBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },

  // Match items in modal
  matchItemCandidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  matchCandidateThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  matchCandidateTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
  },
  matchCandidateLoc: {
    fontSize: 11,
    color: '#8E8E93',
  },
  matchCandidateArrow: {
    fontSize: 16,
    color: '#111',
    fontWeight: '800',
  },

  // History timeline modal
  summaryItemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111',
  },
  summaryItemSub: {
    fontSize: 11.5,
    color: '#8E8E93',
    marginBottom: 12,
  },
  timelineContainer: {
    paddingVertical: 10,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000',
    marginTop: 3,
  },
  timelineLine: {
    width: 2,
    height: 22,
    backgroundColor: '#E5E5EA',
    marginLeft: 4,
    marginVertical: 2,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#111',
  },
  timelineDesc: {
    fontSize: 11,
    color: '#666',
  },

  // Notifications Page
  pageInnerContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  pageTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pageTitleCenter: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
    flex: 1,
    textAlign: 'center',
  },
  markReadLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
  },
  tabBarPillContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    gap: 8,
  },
  tabBarPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
  },
  tabBarPillActive: {
    backgroundColor: '#000',
  },
  tabBarPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#666',
  },
  tabBarPillTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  notifFeed: {
    padding: 16,
    gap: 10,
  },
  notifRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  notifRowUnread: {
    backgroundColor: '#F0F4FF',
    borderColor: '#C7D7FE',
  },
  notifIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifIconGlyph: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  notifItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111',
  },
  notifItemMessage: {
    fontSize: 12,
    color: '#555',
    lineHeight: 16,
    marginTop: 2,
  },
  notifItemTime: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 4,
  },

  // Profile Page
  circularHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnSymbol: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111',
  },
  profileHeaderCard: {
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  profileAvatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  profileAvatarLargeText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  profileNameLarge: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111',
  },
  rolePillProfile: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginVertical: 4,
  },
  rolePillProfileText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#666',
  },
  profileEmailSub: {
    fontSize: 12,
    color: '#8E8E93',
  },
  profileMemberSince: {
    fontSize: 10.5,
    color: '#A1A1A6',
    marginTop: 2,
  },
  liveStatsStrip: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  statMiniCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  statMiniNum: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111',
  },
  statMiniLabel: {
    fontSize: 10.5,
    color: '#8E8E93',
    marginTop: 2,
  },
  profileSectionBox: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  profileSectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#111',
    marginBottom: 10,
  },
  fieldLabelSmall: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#444',
  },
  prefTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  prefTabBtnActive: {
    backgroundColor: '#000',
  },
  prefTabBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#666',
  },
  prefTabBtnTextActive: {
    color: '#FFF',
  },
  saveProfileBtn: {
    backgroundColor: '#000',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  saveProfileBtnText: {
    color: '#FFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  infoSummaryBox: {
    gap: 6,
  },
  infoSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoSummaryLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  infoSummaryVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#111',
  },
  toggleSub: {
    fontSize: 10.5,
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
    backgroundColor: '#000',
  },
  customSwitchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
  },
  customSwitchThumbOn: {
    alignSelf: 'flex-end',
  },
  outlineActionBtn: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  outlineActionBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#111',
  },
  dangerActionBtn: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  dangerActionBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#EF4444',
  },
  quickLinksSection: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  quickLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  quickLinkText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#111',
  },
  quickLinkArrow: {
    fontSize: 13,
    color: '#8E8E93',
  },
  versionFooter: {
    fontSize: 10.5,
    color: '#A1A1A6',
    textAlign: 'center',
    marginTop: 10,
  },
  passwordErrorText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  guideHeading: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#111',
    marginTop: 8,
    marginBottom: 2,
  },
  guideText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  finderInfoCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  finderInfoCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#111111',
    fontFamily: 'Poppins-Bold',
    marginBottom: 4,
  },
  finderInfoCardSub: {
    fontSize: 11.5,
    color: '#6B7280',
    fontFamily: 'Poppins-Regular',
    lineHeight: 16,
  },
  recoveredSuccessBadge: {
    backgroundColor: '#ECFDF5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  recoveredSuccessBadgeText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  chatHeaderHandoverBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  chatHeaderHandoverBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  handoverFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 4,
    marginTop: 8,
    fontFamily: 'Poppins-SemiBold',
  },
  handoverInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111111',
    fontFamily: 'Poppins-Regular',
  },
  handoverHelperText: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 6,
    fontFamily: 'Poppins-Regular',
  },
  handoverPhotoBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  handoverCameraBtn: {
    flex: 1,
    backgroundColor: '#000000',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  handoverCameraBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
  },
  handoverGalleryBtn: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  handoverGalleryBtnText: {
    color: '#111111',
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: 'Poppins-Medium',
  },
  handoverIdPreviewBox: {
    alignItems: 'center',
    marginVertical: 8,
    padding: 8,
    backgroundColor: '#0F172A',
    borderRadius: 12,
  },
  handoverIdPreviewImg: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    resizeMode: 'contain',
  },
  handoverIdPreviewActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  handoverChangePhotoBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#334155',
    borderRadius: 6,
  },
  handoverChangePhotoText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Poppins-Medium',
  },
  handoverRemovePhotoBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#EF4444',
    borderRadius: 6,
  },
  handoverRemovePhotoText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Poppins-Medium',
  },
  handoverErrorBox: {
    backgroundColor: '#FEE2E2',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  handoverErrorText: {
    color: '#991B1B',
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: 'Poppins-Medium',
  },

  // ── Claim Review Panel Styles ────────────────────────────────────────────────
  claimReviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  claimReviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  claimReviewName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
    fontFamily: 'Poppins-Bold',
    flex: 1,
  },
  claimStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginLeft: 8,
  },
  claimStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
    color: '#374151',
  },
  claimReviewRole: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'Poppins-Regular',
    marginBottom: 10,
  },
  claimOwnershipLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 6,
  },
  claimOwnershipBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  claimOwnershipText: {
    fontSize: 13,
    color: '#1E293B',
    fontFamily: 'Poppins-Regular',
    lineHeight: 20,
  },
  claimReviewMeta: {
    fontSize: 10.5,
    color: '#9CA3AF',
    fontFamily: 'Poppins-Regular',
    marginBottom: 12,
  },
  claimActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  claimApproveBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  claimApproveBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  claimRejectBtn: {
    flex: 0.45,
    backgroundColor: '#FEE2E2',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  claimRejectBtnText: {
    color: '#DC2626',
    fontSize: 12.5,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
});
