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
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  storage,
  fetchAdminAnalytics,
  fetchAdminItems,
  adminCloseItem,
  triggerAutoEscalation,
  AdminAnalytics,
  Item,
} from '@/services/api';
import { DeviceContainer } from '@/components/DeviceContainer';

const DEPT_COLORS = [
  '#6366f1','#ec4899','#f59e0b','#22c55e',
  '#3b82f6','#8b5cf6','#14b8a6','#f97316',
  '#84cc16','#06b6d4','#e11d48','#d97706',
];

function BigStatCard({
  icon, value, label, sub, color, bgColor,
}: {
  icon: string; value: string | number; label: string; sub?: string; color: string; bgColor: string;
}) {
  return (
    <View style={[styles.bigStatCard, { backgroundColor: bgColor }]}>
      <View style={[styles.bigStatIconBox, { backgroundColor: color + '22' }]}>
        <Text style={styles.bigStatIcon}>{icon}</Text>
      </View>
      <Text style={[styles.bigStatValue, { color }]}>{value}</Text>
      <Text style={styles.bigStatLabel}>{label}</Text>
      {sub && <Text style={styles.bigStatSub}>{sub}</Text>}
    </View>
  );
}

function DeptBar({
  name, code, total, recovered, color,
}: {
  name: string; code: string; total: number; recovered: number; color: string;
}) {
  const pct = total > 0 ? (recovered / total) * 100 : 0;
  return (
    <View style={styles.deptBarRow}>
      <View style={styles.deptBarLeft}>
        <View style={[styles.deptCodeBadge, { backgroundColor: color + '20', borderColor: color + '60' }]}>
          <Text style={[styles.deptCodeText, { color }]}>{code}</Text>
        </View>
        <View style={styles.deptBarInfo}>
          <Text style={styles.deptBarName} numberOfLines={1}>{name}</Text>
          <Text style={styles.deptBarMeta}>{recovered} of {total} recovered</Text>
        </View>
      </View>
      <View style={styles.deptBarRight}>
        <View style={styles.deptBarTrack}>
          <View style={[styles.deptBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
        </View>
        <Text style={[styles.deptBarPct, { color }]}>{Math.round(pct)}%</Text>
      </View>
    </View>
  );
}

function CategoryRow({ category, count, maxCount }: { category: string; count: number; maxCount: number }) {
  const icons: Record<string, string> = {
    electronics: '💻', wallets: '👛', 'id cards': '🪪', keys: '🔑',
    bags: '🎒', books: '📚', shoes: '👟', jewelry: '💎', clothing: '👕', others: '📦',
  };
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <View style={styles.catRow}>
      <Text style={styles.catIcon}>{icons[category.toLowerCase()] || '📦'}</Text>
      <View style={styles.catInfo}>
        <Text style={styles.catName}>{category}</Text>
        <View style={styles.catBarTrack}>
          <View style={[styles.catBarFill, { width: `${pct}%` as any }]} />
        </View>
      </View>
      <Text style={styles.catCount}>{count}</Text>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    'Escalated to Department': { bg: '#fef3c7', text: '#d97706' },
    'With Department':         { bg: '#dbeafe', text: '#1d4ed8' },
    'Under Verification':      { bg: '#ede9fe', text: '#7c3aed' },
    Recovered:                 { bg: '#dcfce7', text: '#16a34a' },
    'At Admin Office':         { bg: '#fce7f3', text: '#9d174d' },
    Found:                     { bg: '#f0fdf4', text: '#15803d' },
  };
  const c = colorMap[status] || { bg: '#f3f4f6', text: '#374151' };
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.text }]}>{status}</Text>
    </View>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const user = storage.getUser();
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [adminItems, setAdminItems] = useState<Item[]>([]);
  const [activeTab, setActiveTab] = useState<'analytics' | 'items' | 'escalations'>('analytics');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  // Close item modal
  const [closeModal, setCloseModal] = useState(false);
  const [closeItemId, setCloseItemId] = useState<number | null>(null);
  const [closeName, setCloseName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [analyticsData, itemsData] = await Promise.all([
        fetchAdminAnalytics(),
        fetchAdminItems(),
      ]);
      setAnalytics(analyticsData);
      setAdminItems(itemsData);
    } catch (e) {
      console.error('Failed to load admin data', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleAutoEscalate = async () => {
    try {
      setActionLoading(true);
      const result = await triggerAutoEscalation();
      alert(`✅ Auto-escalation complete: ${result.total} items escalated.`);
      loadData();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseItem = async () => {
    if (!closeName.trim()) { alert('Please enter the recipient name.'); return; }
    try {
      setActionLoading(true);
      await adminCloseItem(closeItemId!, closeName);
      setCloseModal(false);
      setCloseName('');
      loadData();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredItems = adminItems.filter((item) => {
    if (!searchText.trim()) return true;
    const q = searchText.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q)
    );
  });

  const maxCatCount = analytics?.by_category?.[0]?.count || 1;

  return (
    <DeviceContainer>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
            <Text style={styles.headerSub}>Central Lost & Found Office</Text>
          </View>
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>👑 Admin</Text>
          </View>
        </View>

        {/* Tab selector */}
        <View style={styles.mainTabs}>
          {[
            { key: 'analytics', icon: '📊', label: 'Analytics' },
            { key: 'items',     icon: '🏛',  label: 'Office Items' },
            { key: 'escalations', icon: '⚡', label: 'Escalations' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.mainTab, activeTab === tab.key && styles.mainTabActive]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Text style={styles.mainTabIcon}>{tab.icon}</Text>
              <Text style={[styles.mainTabText, activeTab === tab.key && styles.mainTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Loading admin data…</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.scrollContent}
          >

            {/* ── ANALYTICS TAB ── */}
            {activeTab === 'analytics' && analytics && (
              <>
                {/* Key Metrics Grid */}
                <Text style={styles.sectionTitle}>📈 Key Metrics</Text>
                <View style={styles.bigStatsGrid}>
                  <BigStatCard
                    icon="📋" value={analytics.total_items}
                    label="Total Items" color="#6366f1" bgColor="#f5f3ff"
                  />
                  <BigStatCard
                    icon="✅" value={analytics.total_recovered}
                    label="Recovered"
                    sub={`${analytics.recovery_rate}% rate`}
                    color="#22c55e" bgColor="#f0fdf4"
                  />
                  <BigStatCard
                    icon="🔍" value={analytics.total_found}
                    label="Found Reports" color="#3b82f6" bgColor="#eff6ff"
                  />
                  <BigStatCard
                    icon="❓" value={analytics.total_lost}
                    label="Lost Reports" color="#f59e0b" bgColor="#fffbeb"
                  />
                  <BigStatCard
                    icon="🏛" value={analytics.total_at_departments}
                    label="At Departments" color="#8b5cf6" bgColor="#faf5ff"
                  />
                  <BigStatCard
                    icon="🏢" value={analytics.total_at_admin}
                    label="At Admin Office" color="#ec4899" bgColor="#fdf2f8"
                  />
                </View>

                {/* Recovery rate banner */}
                <View style={[
                  styles.recoveryBanner,
                  { backgroundColor: analytics.recovery_rate >= 50 ? '#dcfce7' : '#fef3c7' }
                ]}>
                  <Text style={styles.recoveryBannerText}>
                    {analytics.recovery_rate >= 50 ? '🎉' : '⚠️'}{' '}
                    Campus Recovery Rate:{' '}
                    <Text style={[
                      styles.recoveryBannerPct,
                      { color: analytics.recovery_rate >= 50 ? '#15803d' : '#b45309' }
                    ]}>
                      {analytics.recovery_rate}%
                    </Text>
                    {'  '}
                    ({analytics.total_recovered} of {analytics.total_items} items recovered)
                  </Text>
                </View>

                {/* By Department */}
                <Text style={styles.sectionTitle}>🏛 By Department</Text>
                <View style={styles.card}>
                  {analytics.by_department.length === 0 ? (
                    <Text style={styles.emptyCardText}>No department data yet.</Text>
                  ) : (
                    analytics.by_department.map((dept, idx) => (
                      <DeptBar
                        key={dept.department_code}
                        code={dept.department_code}
                        name={dept.department_name}
                        total={dept.total}
                        recovered={dept.recovered}
                        color={DEPT_COLORS[idx % DEPT_COLORS.length]}
                      />
                    ))
                  )}
                </View>

                {/* By Category */}
                <Text style={styles.sectionTitle}>📦 By Category</Text>
                <View style={styles.card}>
                  {analytics.by_category.map((cat) => (
                    <CategoryRow
                      key={cat.category}
                      category={cat.category}
                      count={cat.count}
                      maxCount={maxCatCount}
                    />
                  ))}
                </View>

                {/* Status breakdown */}
                <Text style={styles.sectionTitle}>🔄 Status Breakdown</Text>
                <View style={styles.statusGrid}>
                  {analytics.by_status.map((s) => {
                    const colorMap: Record<string, string> = {
                      'Recovered': '#22c55e',
                      'Found': '#3b82f6',
                      'Reported': '#f59e0b',
                      'Matched': '#8b5cf6',
                      'Under Verification': '#6366f1',
                      'Escalated to Department': '#f97316',
                      'With Department': '#0ea5e9',
                      'At Admin Office': '#ec4899',
                    };
                    const color = colorMap[s.status] || '#6b7280';
                    return (
                      <View key={s.status} style={styles.statusCard}>
                        <Text style={[styles.statusCount, { color }]}>{s.count}</Text>
                        <Text style={styles.statusName}>{s.status}</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Auto-escalate trigger */}
                <View style={styles.actionSection}>
                  <Text style={styles.actionSectionTitle}>⚙️ System Actions</Text>
                  <TouchableOpacity
                    style={styles.escalateBtn}
                    onPress={handleAutoEscalate}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.escalateBtnIcon}>⚡</Text>
                        <Text style={styles.escalateBtnText}>Run Auto-Escalation Check</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.escalateBtnHint}>
                    Automatically escalates unmatched found items after 24h,
                    and department items after 7 days to the Admin office.
                  </Text>
                </View>
              </>
            )}

            {/* ── ITEMS TAB ── */}
            {activeTab === 'items' && (
              <>
                <View style={styles.itemsHeader}>
                  <Text style={styles.sectionTitle}>🏢 Items at Admin Office</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{adminItems.length} items</Text>
                  </View>
                </View>

                {/* Search */}
                <View style={styles.searchBar}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search items..."
                    placeholderTextColor="#a0a0a0"
                    value={searchText}
                    onChangeText={setSearchText}
                  />
                </View>

                {/* Info */}
                <View style={styles.infoBanner}>
                  <Text style={styles.infoBannerIcon}>📍</Text>
                  <Text style={styles.infoBannerText}>
                    These are items found in common areas (Library, Canteen, Bus Stand, etc.)
                    with no owner after 24h, or department items unclaimed after 7 days.
                    Owners can collect directly from the Admin Office.
                  </Text>
                </View>

                {filteredItems.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyIcon}>🏢</Text>
                    <Text style={styles.emptyTitle}>No items at Admin Office</Text>
                    <Text style={styles.emptySubtitle}>All items have been recovered or are still with departments.</Text>
                  </View>
                ) : (
                  <View style={styles.itemsList}>
                    {filteredItems.map((item) => (
                      <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemCardTop}>
                          <View style={styles.itemCardTopLeft}>
                            <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.itemMeta}>
                              📍 {item.location} · {item.category}
                            </Text>
                          </View>
                          <View style={styles.itemCardTopRight}>
                            {item.is_valuable && (
                              <View style={styles.valuableBadge}>
                                <Text style={styles.valuableBadgeText}>💎</Text>
                              </View>
                            )}
                            <StatusPill status={item.status} />
                          </View>
                        </View>

                        <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>

                        {item.admin_received_at && (
                          <View style={styles.receivedInfo}>
                            <Text style={styles.receivedInfoText}>
                              🏢 At Admin Office since:{' '}
                              {new Date(item.admin_received_at).toLocaleDateString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric'
                              })}
                            </Text>
                          </View>
                        )}

                        <View style={styles.itemActions}>
                          {item.status !== 'Recovered' && (
                            <TouchableOpacity
                              style={styles.closeBtn}
                              onPress={() => { setCloseItemId(item.id); setCloseModal(true); }}
                            >
                              <Text style={styles.closeBtnText}>✅ Mark as Picked Up</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={styles.viewBtn}
                            onPress={() => router.push(`/dashboard?itemId=${item.id}`)}
                          >
                            <Text style={styles.viewBtnText}>👁 View</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* ── ESCALATIONS TAB ── */}
            {activeTab === 'escalations' && analytics && (
              <>
                <Text style={styles.sectionTitle}>⚡ Recent Escalation History</Text>
                <Text style={styles.escalationsSubtitle}>
                  Track how items move between user → department → admin levels.
                </Text>

                {analytics.recent_escalations.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyIcon}>⚡</Text>
                    <Text style={styles.emptyTitle}>No escalations yet</Text>
                  </View>
                ) : (
                  <View style={styles.escalationList}>
                    {analytics.recent_escalations.map((esc, idx) => (
                      <View key={idx} style={styles.escalationItem}>
                        <View style={styles.escalationIcon}>
                          <Text>{esc.to_level === 'admin' ? '🏢' : '🏛'}</Text>
                        </View>
                        <View style={styles.escalationContent}>
                          <Text style={styles.escalationItemTitle} numberOfLines={1}>
                            {esc.item_title}
                          </Text>
                          <Text style={styles.escalationPath}>
                            {esc.from_level} → {esc.to_level}
                          </Text>
                          <Text style={styles.escalationReason} numberOfLines={1}>
                            {esc.reason}
                          </Text>
                          <Text style={styles.escalationTime}>
                            {new Date(esc.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </Text>
                        </View>
                        <View style={[
                          styles.escalationLevelBadge,
                          { backgroundColor: esc.to_level === 'admin' ? '#fce7f3' : '#ede9fe' }
                        ]}>
                          <Text style={[
                            styles.escalationLevelText,
                            { color: esc.to_level === 'admin' ? '#9d174d' : '#6d28d9' }
                          ]}>
                            {esc.escalated_by === 'system' ? '🤖 Auto' : '👤 Manual'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>

      {/* Close Item Modal */}
      <Modal
        visible={closeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setCloseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>✅ Mark Item as Picked Up</Text>
            <Text style={styles.modalSubtitle}>
              Record who picked up the item from the Admin Office.
            </Text>
            <Text style={styles.modalLabel}>Owner / Recipient Name *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter full name of recipient"
              placeholderTextColor="#a0a0a0"
              value={closeName}
              onChangeText={setCloseName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setCloseModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleCloseItem}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm</Text>
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
    backgroundColor: '#0f0a2e',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 42,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerCenter: { flex: 1 },
  headerTitle: {
    color: '#ffffff', fontSize: 18, fontWeight: '800',
    fontFamily: 'Poppins-Bold',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.6)', fontSize: 12,
    fontFamily: 'Poppins-Regular',
  },
  adminBadge: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
  },
  adminBadgeText: { color: '#78350f', fontSize: 11, fontWeight: '700' },

  // Main Tabs
  mainTabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  mainTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 5,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  mainTabActive: { borderBottomColor: '#6366f1' },
  mainTabIcon: { fontSize: 14 },
  mainTabText: {
    fontSize: 11, fontWeight: '600', color: '#9ca3af',
    fontFamily: 'Poppins-SemiBold',
  },
  mainTabTextActive: { color: '#6366f1' },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  loadingText: { color: '#6366f1', marginTop: 12, fontFamily: 'Poppins-Regular' },

  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: {
    fontSize: 15, fontWeight: '800', color: '#111827',
    marginBottom: 10, marginTop: 4,
    fontFamily: 'Poppins-Bold',
  },

  // Big Stats Grid
  bigStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  bigStatCard: {
    width: '47%',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  bigStatIconBox: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  bigStatIcon: { fontSize: 22 },
  bigStatValue: { fontSize: 26, fontWeight: '900', fontFamily: 'Poppins-Bold' },
  bigStatLabel: {
    fontSize: 11, color: '#6b7280', marginTop: 2,
    fontFamily: 'Poppins-Regular',
  },
  bigStatSub: { fontSize: 10, color: '#9ca3af', fontFamily: 'Poppins-Regular' },

  // Recovery banner
  recoveryBanner: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  recoveryBannerText: {
    fontSize: 13, color: '#374151', lineHeight: 20,
    fontFamily: 'Poppins-Regular',
  },
  recoveryBannerPct: { fontSize: 18, fontWeight: '800', fontFamily: 'Poppins-Bold' },

  // Dept bars
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  emptyCardText: { color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  deptBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deptBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 140 },
  deptCodeBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  deptCodeText: { fontSize: 11, fontWeight: '800', fontFamily: 'Poppins-Bold' },
  deptBarInfo: { flex: 1 },
  deptBarName: { fontSize: 11, fontWeight: '600', color: '#374151', fontFamily: 'Poppins-SemiBold' },
  deptBarMeta: { fontSize: 10, color: '#9ca3af', fontFamily: 'Poppins-Regular' },
  deptBarRight: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  deptBarTrack: { flex: 1, height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  deptBarFill: { height: '100%', borderRadius: 3 },
  deptBarPct: { fontSize: 11, fontWeight: '700', width: 32, textAlign: 'right', fontFamily: 'Poppins-Bold' },

  // Category
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  catIcon: { fontSize: 20, width: 24 },
  catInfo: { flex: 1 },
  catName: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4, fontFamily: 'Poppins-SemiBold' },
  catBarTrack: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  catBarFill: { height: '100%', backgroundColor: '#6366f1', borderRadius: 3 },
  catCount: { fontSize: 14, fontWeight: '800', color: '#111827', width: 28, textAlign: 'right', fontFamily: 'Poppins-Bold' },

  // Status grid
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    width: '31%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statusCount: { fontSize: 20, fontWeight: '800', fontFamily: 'Poppins-Bold' },
  statusName: {
    fontSize: 9, color: '#6b7280', textAlign: 'center', marginTop: 2,
    fontFamily: 'Poppins-Regular',
  },

  // Auto-escalate
  actionSection: { marginBottom: 16 },
  actionSectionTitle: {
    fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 10,
    fontFamily: 'Poppins-SemiBold',
  },
  escalateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e1b4b',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#1e1b4b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  escalateBtnIcon: { fontSize: 18 },
  escalateBtnText: {
    color: '#fff', fontSize: 14, fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  escalateBtnHint: {
    fontSize: 11, color: '#9ca3af', marginTop: 8, lineHeight: 16,
    fontFamily: 'Poppins-Regular',
  },

  // Items tab
  itemsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  countBadge: {
    backgroundColor: '#ede9fe', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
  },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#6d28d9', fontFamily: 'Poppins-Bold' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 13, color: '#111', fontFamily: 'Poppins-Regular', outlineStyle: 'none' as any },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoBannerIcon: { fontSize: 16 },
  infoBannerText: {
    flex: 1, fontSize: 12, color: '#1e40af', lineHeight: 18,
    fontFamily: 'Poppins-Regular',
  },
  emptyBox: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', fontFamily: 'Poppins-SemiBold' },
  emptySubtitle: {
    fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 6, lineHeight: 20,
    fontFamily: 'Poppins-Regular',
  },
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
  itemCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  itemCardTopLeft: { flex: 1 },
  itemCardTopRight: { alignItems: 'flex-end', gap: 4 },
  itemTitle: {
    fontSize: 14, fontWeight: '700', color: '#111827',
    fontFamily: 'Poppins-Bold',
  },
  itemMeta: { fontSize: 11, color: '#6b7280', marginTop: 2, fontFamily: 'Poppins-Regular' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pillText: { fontSize: 10, fontWeight: '700', fontFamily: 'Poppins-Bold' },
  valuableBadge: {
    backgroundColor: '#fdf2f8', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1, borderColor: '#f0abfc',
  },
  valuableBadgeText: { fontSize: 13 },
  itemDesc: {
    fontSize: 12, color: '#4b5563', lineHeight: 18, marginBottom: 8,
    fontFamily: 'Poppins-Regular',
  },
  receivedInfo: {
    backgroundColor: '#f0fdf4', borderRadius: 8, padding: 6, marginBottom: 8,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  receivedInfoText: { fontSize: 11, color: '#166534', fontFamily: 'Poppins-Regular' },
  itemActions: { flexDirection: 'row', gap: 8 },
  closeBtn: {
    flex: 1, backgroundColor: '#f0fdf4', borderRadius: 10,
    paddingVertical: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#bbf7d0',
  },
  closeBtnText: { fontSize: 12, fontWeight: '700', color: '#15803d', fontFamily: 'Poppins-Bold' },
  viewBtn: {
    backgroundColor: '#f5f3ff', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#ddd6fe',
  },
  viewBtnText: { fontSize: 12, fontWeight: '700', color: '#6366f1', fontFamily: 'Poppins-Bold' },

  // Escalations
  escalationsSubtitle: {
    fontSize: 12, color: '#6b7280', marginBottom: 14, lineHeight: 18,
    fontFamily: 'Poppins-Regular',
  },
  escalationList: { gap: 10 },
  escalationItem: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  escalationIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f5f3ff',
    alignItems: 'center', justifyContent: 'center',
  },
  escalationContent: { flex: 1 },
  escalationItemTitle: {
    fontSize: 13, fontWeight: '700', color: '#111827',
    fontFamily: 'Poppins-SemiBold',
  },
  escalationPath: { fontSize: 11, color: '#6366f1', fontWeight: '600', marginTop: 2 },
  escalationReason: { fontSize: 11, color: '#6b7280', marginTop: 1, fontFamily: 'Poppins-Regular' },
  escalationTime: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  escalationLevelBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
  },
  escalationLevelText: { fontSize: 10, fontWeight: '700', fontFamily: 'Poppins-Bold' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
  },
  modalTitle: {
    fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 6,
    fontFamily: 'Poppins-Bold',
  },
  modalSubtitle: {
    fontSize: 13, color: '#6b7280', marginBottom: 18, lineHeight: 18,
    fontFamily: 'Poppins-Regular',
  },
  modalLabel: {
    fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6,
    fontFamily: 'Poppins-SemiBold',
  },
  modalInput: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#111',
    marginBottom: 14,
    fontFamily: 'Poppins-Regular',
    outlineStyle: 'none' as any,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#e5e7eb', alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#374151', fontFamily: 'Poppins-SemiBold' },
  modalConfirmBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#0f0a2e', alignItems: 'center', justifyContent: 'center',
  },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: '#ffffff', fontFamily: 'Poppins-Bold' },
});
