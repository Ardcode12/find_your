import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  storage,
  fetchDepartmentItems,
  fetchDepartmentStats,
  departmentReceiveItem,
  departmentVerifyAndHandover,
  escalateToAdmin,
  Item,
  DeptDashboardStats,
} from '@/services/api';
import { DeviceContainer } from '@/components/DeviceContainer';

const STATUS_TABS = [
  { key: 'all',            label: 'All',        color: '#6366f1', icon: '📋' },
  { key: 'Escalated to Department', label: 'Pending', color: '#f59e0b', icon: '⏳' },
  { key: 'With Department',         label: 'Received', color: '#3b82f6', icon: '📦' },
  { key: 'Under Verification',      label: 'Verifying', color: '#8b5cf6', icon: '🔍' },
  { key: 'Recovered',               label: 'Handed Over', color: '#22c55e', icon: '✅' },
];

const ESCALATION_LEVEL_LABEL: Record<string, string> = {
  user: 'Reported by User',
  department: 'Department',
  admin: 'Admin Office',
};

function StatusPill({ status }: { status: string }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    'Escalated to Department': { bg: '#fef3c7', text: '#d97706' },
    'With Department':         { bg: '#dbeafe', text: '#1d4ed8' },
    'Under Verification':      { bg: '#ede9fe', text: '#7c3aed' },
    Recovered:                 { bg: '#dcfce7', text: '#16a34a' },
    Found:                     { bg: '#f0fdf4', text: '#15803d' },
    Matched:                   { bg: '#eff6ff', text: '#2563eb' },
    'At Admin Office':         { bg: '#fce7f3', text: '#9d174d' },
  };
  const c = colorMap[status] || { bg: '#f3f4f6', text: '#374151' };
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.text }]}>{status}</Text>
    </View>
  );
}

function ValuableBadge() {
  return (
    <View style={styles.valuableBadge}>
      <Text style={styles.valuableBadgeText}>💎 Valuable</Text>
    </View>
  );
}

function StatCard({ icon, value, label, color }: {
  icon: string; value: number; label: string; color: string;
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DepartmentScreen() {
  const router = useRouter();
  const user = storage.getUser();
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<DeptDashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  // Handover modal state
  const [handoverModal, setHandoverModal] = useState(false);
  const [handoverItemId, setHandoverItemId] = useState<number | null>(null);
  const [handoverName, setHandoverName] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const statusFilter = activeTab === 'all' ? undefined : activeTab;
      const [itemsData, statsData] = await Promise.all([
        fetchDepartmentItems(statusFilter),
        fetchDepartmentStats(),
      ]);
      setItems(itemsData);
      setStats(statsData);
    } catch (e) {
      console.error('Failed to load department data', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleReceive = async (itemId: number) => {
    try {
      setActionLoading(true);
      await departmentReceiveItem(itemId);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleHandover = async () => {
    if (!handoverName.trim()) {
      Alert.alert('Required', 'Please enter the name of who is receiving the item.');
      return;
    }
    try {
      setActionLoading(true);
      await departmentVerifyAndHandover(handoverItemId!, handoverName, handoverNotes);
      setHandoverModal(false);
      setHandoverName('');
      setHandoverNotes('');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscalateToAdmin = async (itemId: number) => {
    const confirm = Platform.OS === 'web'
      ? window.confirm('Send this item to the Admin Office?')
      : true;
    if (!confirm) return;
    try {
      setActionLoading(true);
      await escalateToAdmin(itemId, 'No owner response after 7 days at department');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!searchText.trim()) return true;
    const q = searchText.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q)
    );
  });

  return (
    <DeviceContainer>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>
              {user?.department_code || 'Dept.'} Dashboard
            </Text>
            <Text style={styles.headerSub}>
              {user?.department || 'Department'} Office
            </Text>
          </View>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>🛡 Dept. Admin</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Stats Row */}
          {stats && (
            <View style={styles.statsRow}>
              <StatCard icon="📦" value={stats.total}     label="Total"     color="#6366f1" />
              <StatCard icon="⏳" value={stats.pending}   label="Pending"   color="#f59e0b" />
              <StatCard icon="✅" value={stats.recovered} label="Recovered" color="#22c55e" />
              <StatCard icon="💎" value={stats.valuable}  label="Valuable"  color="#ec4899" />
            </View>
          )}

          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerIcon}>📋</Text>
            <Text style={styles.infoBannerText}>
              Items found in your department area or valuable items are escalated here.
              Verify ownership before handing over.
            </Text>
          </View>

          {/* Search bar */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search items by name, category, location..."
              placeholderTextColor="#a0a0a0"
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>

          {/* Status Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsContainer}
            contentContainerStyle={styles.tabs}
          >
            {STATUS_TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.8}
                style={[
                  styles.tab,
                  activeTab === tab.key && { backgroundColor: tab.color, borderColor: tab.color }
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text style={[
                  styles.tabText,
                  activeTab === tab.key && { color: '#ffffff' }
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Items List */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>Loading items…</Text>
            </View>
          ) : filteredItems.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>No items found</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'all'
                  ? 'No items are assigned to your department yet.'
                  : `No items in "${STATUS_TABS.find(t => t.key === activeTab)?.label}" status.`}
              </Text>
            </View>
          ) : (
            <View style={styles.itemsList}>
              {filteredItems.map((item) => (
                <View key={item.id} style={styles.itemCard}>
                  {/* Card Header */}
                  <View style={styles.itemCardHeader}>
                    <View style={styles.itemCardHeaderLeft}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.itemMeta}>
                        📍 {item.location} · {item.incident_date}
                      </Text>
                    </View>
                    <View style={styles.itemCardHeaderRight}>
                      {item.is_valuable && <ValuableBadge />}
                      <StatusPill status={item.status} />
                    </View>
                  </View>

                  {/* Category & Reporter */}
                  <View style={styles.itemRow}>
                    <View style={styles.itemTag}>
                      <Text style={styles.itemTagText}>{item.category}</Text>
                    </View>
                    <Text style={styles.itemReporter}>
                      By {item.reporter_name} ({item.reporter_role})
                    </Text>
                  </View>

                  {/* Description */}
                  <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>

                  {/* Escalation info */}
                  {item.escalation_at && (
                    <View style={styles.escalationInfo}>
                      <Text style={styles.escalationInfoText}>
                        ⚡ Escalated: {new Date(item.escalation_at).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </Text>
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.actionRow}>
                    {item.status === 'Escalated to Department' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnReceive]}
                        onPress={() => handleReceive(item.id)}
                        disabled={actionLoading}
                      >
                        <Text style={styles.actionBtnText}>📦 Receive Item</Text>
                      </TouchableOpacity>
                    )}

                    {(item.status === 'With Department' || item.status === 'Under Verification') && (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnHandover]}
                        onPress={() => {
                          setHandoverItemId(item.id);
                          setHandoverModal(true);
                        }}
                        disabled={actionLoading}
                      >
                        <Text style={styles.actionBtnText}>✅ Verify & Handover</Text>
                      </TouchableOpacity>
                    )}

                    {item.status === 'With Department' && item.dept_received_at && (
                      (() => {
                        const daysSince = Math.floor(
                          (Date.now() - new Date(item.dept_received_at).getTime()) / 86400000
                        );
                        return daysSince >= 7 ? (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.actionBtnAdmin]}
                            onPress={() => handleEscalateToAdmin(item.id)}
                            disabled={actionLoading}
                          >
                            <Text style={styles.actionBtnText}>🏛 Send to Admin</Text>
                          </TouchableOpacity>
                        ) : null;
                      })()
                    )}

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnView]}
                      onPress={() => router.push(`/dashboard?itemId=${item.id}`)}
                    >
                      <Text style={[styles.actionBtnText, { color: '#6366f1' }]}>👁 Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Footer space */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      {/* Handover Modal */}
      <Modal
        visible={handoverModal}
        transparent
        animationType="slide"
        onRequestClose={() => setHandoverModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>✅ Verify & Handover Item</Text>
            <Text style={styles.modalSubtitle}>
              Confirm ownership verification and record handover details.
            </Text>

            <Text style={styles.modalLabel}>Recipient Name *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter the owner's full name"
              placeholderTextColor="#a0a0a0"
              value={handoverName}
              onChangeText={setHandoverName}
            />

            <Text style={styles.modalLabel}>Verification Notes (Optional)</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              placeholder="e.g. Owner showed valid ID, confirmed item serial number..."
              placeholderTextColor="#a0a0a0"
              value={handoverNotes}
              onChangeText={setHandoverNotes}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setHandoverModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleHandover}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm Handover</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </DeviceContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f7ff' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 42,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerText: { flex: 1 },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
  },
  roleTag: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleTagText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statIcon: { fontSize: 18, marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '800', fontFamily: 'Poppins-Bold' },
  statLabel: { fontSize: 9, color: '#71717a', marginTop: 1, fontFamily: 'Poppins-Regular' },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoBannerIcon: { fontSize: 16 },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 18,
    fontFamily: 'Poppins-Regular',
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  searchIcon: { fontSize: 15 },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111',
    outlineStyle: 'none' as any,
    fontFamily: 'Poppins-Regular',
  },

  // Tabs
  tabsContainer: { marginBottom: 14 },
  tabs: { gap: 8, paddingRight: 8 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    gap: 5,
  },
  tabIcon: { fontSize: 13 },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Poppins-SemiBold',
  },

  // Loading / Empty
  loadingBox: { alignItems: 'center', paddingVertical: 48 },
  loadingText: { color: '#6366f1', marginTop: 12, fontFamily: 'Poppins-Regular' },
  emptyBox: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Poppins-SemiBold',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    fontFamily: 'Poppins-Regular',
  },

  // Item cards
  itemsList: { gap: 12 },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  itemCardHeaderLeft: { flex: 1 },
  itemCardHeaderRight: { alignItems: 'flex-end', gap: 4 },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Poppins-Bold',
  },
  itemMeta: { fontSize: 11, color: '#6b7280', marginTop: 2, fontFamily: 'Poppins-Regular' },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pillText: { fontSize: 10, fontWeight: '700', fontFamily: 'Poppins-Bold' },

  valuableBadge: {
    backgroundColor: '#fdf2f8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f0abfc',
  },
  valuableBadgeText: { fontSize: 10, fontWeight: '700', color: '#9d174d' },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  itemTag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  itemTagText: { fontSize: 11, color: '#374151', fontWeight: '600' },
  itemReporter: { fontSize: 11, color: '#6b7280', fontFamily: 'Poppins-Regular' },
  itemDesc: { fontSize: 12, color: '#4b5563', lineHeight: 18, marginBottom: 8, fontFamily: 'Poppins-Regular' },

  escalationInfo: {
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    padding: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  escalationInfoText: { fontSize: 11, color: '#c2410c', fontFamily: 'Poppins-Regular' },

  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  actionBtnReceive: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  actionBtnHandover: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  actionBtnAdmin: { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
  actionBtnView: { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Poppins-SemiBold',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
    fontFamily: 'Poppins-Bold',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 18,
    lineHeight: 18,
    fontFamily: 'Poppins-Regular',
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    fontFamily: 'Poppins-SemiBold',
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111',
    marginBottom: 14,
    fontFamily: 'Poppins-Regular',
    outlineStyle: 'none' as any,
  },
  modalTextarea: { height: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Poppins-SemiBold',
  },
  modalConfirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#1e1b4b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: 'Poppins-Bold',
  },
});
