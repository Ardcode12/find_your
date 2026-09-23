import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Item, ActivityData, MatchItem } from '@/services/api';

const SAMPLE_PHOTOS = [
  { label: 'Wallet', url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80' },
  { label: 'Sneakers', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80' },
  { label: 'ID Card', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80' },
  { label: 'Electronics', url: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=600&q=80' },
];

interface ActivitySectionProps {
  activity: ActivityData;
  items: Item[];
  onBackToHome: () => void;
  onSwitchTab: (tab: 'home' | 'report' | 'activity' | 'notifications' | 'profile', source?: any) => void;
  onReviewLostMatches: (item: Item) => void;
  onViewItemDetail: (item: Item) => void;
  onEditItem: (item: Item) => void;
  onWithdrawItem: (itemId: number) => void;
  onReviewClaims: (item: Item) => void;
  onOpenMatchChat: (foundItem: Item) => void;
  onContinueMatchVerification: (foundItem: Item) => void;
  onStaffDeskContact: (foundItem: Item) => void;
  onViewHistorySummary: (item: Item) => void;
}

export default function ActivitySection({
  activity,
  items,
  onBackToHome,
  onSwitchTab,
  onReviewLostMatches,
  onViewItemDetail,
  onEditItem,
  onWithdrawItem,
  onReviewClaims,
  onOpenMatchChat,
  onContinueMatchVerification,
  onStaffDeskContact,
  onViewHistorySummary,
}: ActivitySectionProps) {
  // 4 compact sub-tabs that reliably fit all mobile screens (375-390px)
  const [activitySubTab, setActivitySubTab] = useState<'lost' | 'found' | 'matches' | 'history'>('lost');

  // Defensive fallback values to ensure numbers never render as empty blank spaces
  const lostCount = activity?.summary_stats?.lost ?? 0;
  const foundCount = activity?.summary_stats?.found ?? 0;
  const matchesCount = activity?.summary_stats?.active_matches ?? 0;
  const recoveredCount = activity?.summary_stats?.recovered ?? 0;

  const lostReports = activity?.my_lost_reports ?? [];
  const foundReports = activity?.my_found_reports ?? [];
  const matchesList = activity?.my_matches ?? [];
  const recoveredHistory = activity?.recovered_history ?? [];

  return (
    <View style={styles.activityPageWrapper}>
      {/* SECTION 1 — TOP BAR */}
      <View style={styles.activityTopBar}>
        <TouchableOpacity
          style={styles.backBtnCircle}
          onPress={onBackToHome}
          accessibilityLabel="Back to Home"
          activeOpacity={0.7}
        >
          <Text style={styles.backArrowGlyph}>←</Text>
        </TouchableOpacity>
        <Text style={styles.activityScreenTitle}>My Activity</Text>
        <View style={styles.topBarSpacer} />
      </View>

      {/* SECTION 2 — STATS STRIP (4 EQUAL-WIDTH CLEAN CARDS) */}
      <View style={styles.statsStripRow}>
        <View style={styles.statMiniCard}>
          <Text style={styles.statMiniNum}>{lostCount}</Text>
          <Text style={styles.statMiniLabel}>Lost Reports</Text>
        </View>

        <View style={styles.statMiniCard}>
          <Text style={styles.statMiniNum}>{foundCount}</Text>
          <Text style={styles.statMiniLabel}>Found Reports</Text>
        </View>

        <View style={styles.statMiniCard}>
          <Text style={styles.statMiniNum}>{matchesCount}</Text>
          <Text style={styles.statMiniLabel}>Active Matches</Text>
        </View>

        <View style={styles.statMiniCard}>
          <Text style={styles.statMiniNum}>{recoveredCount}</Text>
          <Text style={styles.statMiniLabel}>Recovered</Text>
        </View>
      </View>

      {/* SECTION 3 — SUB-TAB NAVIGATOR (OPTION A: COMPACT 4 TABS FITTING 375-390PX MOBILE SCREEN) */}
      <View style={styles.subTabNavigatorBar}>
        {[
          { id: 'lost', label: 'Lost' },
          { id: 'found', label: 'Found' },
          { id: 'matches', label: 'Matches' },
          { id: 'history', label: 'History' },
        ].map((t) => {
          const isActive = activitySubTab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.subTabPill, isActive && styles.subTabPillActive]}
              onPress={() => setActivitySubTab(t.id as any)}
              activeOpacity={0.8}
            >
              <Text style={[styles.subTabText, isActive && styles.subTabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* SECTION 4 — TAB CONTENTS */}

      {/* TAB 1: MY LOST REPORTS */}
      {activitySubTab === 'lost' && (
        <View style={styles.tabContentContainer}>
          {lostReports.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <View style={styles.emptyStateIconCircle}>
                <Text style={styles.emptyStateIconGlyph}>🔍</Text>
              </View>
              <Text style={styles.emptyStateTitle}>You haven't reported any lost items yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Reports you file remain private and are automatically matched against newly found items.
              </Text>
              <TouchableOpacity
                style={styles.primaryCtaButton}
                onPress={() => onSwitchTab('report', 'hero_lost')}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryCtaButtonText}>Report Lost Item</Text>
              </TouchableOpacity>
            </View>
          ) : (
            lostReports.map((item: Item) => {
              const itemMatches = item.matches_count ?? 0;
              return (
                <View key={item.id} style={styles.activityCard}>
                  <View style={styles.cardHeaderRow}>
                    <Image
                      source={{ uri: item.image_url || SAMPLE_PHOTOS[0].url }}
                      style={styles.itemThumb}
                    />
                    <View style={styles.cardHeaderDetails}>
                      <Text style={styles.cardItemTitle} numberOfLines={1}>{item.title}</Text>

                      {/* Status badge with colored dot */}
                      <View style={styles.statusBadgeRow}>
                        <View style={[
                          styles.statusDot,
                          item.status === 'Recovered' ? styles.dotGreen :
                          item.status === 'Matched' ? styles.dotAmber :
                          item.status === 'Under Verification' ? styles.dotBlue :
                          styles.dotRed
                        ]} />
                        <Text style={styles.statusBadgeText}>{item.status}</Text>
                      </View>

                      <Text style={styles.cardMetaSub}>
                        {item.location} • {item.incident_date || 'Recently'}
                      </Text>
                    </View>
                  </View>

                  {/* Match Indicator Pill */}
                  <View style={styles.indicatorPillRow}>
                    <View style={itemMatches > 0 ? styles.matchPillAmber : styles.matchPillMuted}>
                      <Text style={itemMatches > 0 ? styles.matchTextAmber : styles.matchTextMuted}>
                        {itemMatches > 0 ? `${itemMatches} possible matches detected` : 'No matches found yet'}
                      </Text>
                    </View>
                  </View>

                  {/* Card Actions Footer */}
                  <View style={styles.cardFooterActions}>
                    <TouchableOpacity
                      style={itemMatches > 0 ? styles.actionPrimaryPillBtn : styles.actionSecondaryPillBtn}
                      onPress={() => {
                        if (itemMatches > 0) {
                          onReviewLostMatches(item);
                        } else {
                          onViewItemDetail(item);
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={itemMatches > 0 ? styles.actionPrimaryPillText : styles.actionSecondaryPillText}>
                        {itemMatches > 0 ? 'Review Matches' : 'View Report'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.actionIconGroup}>
                      {/* Edit Button */}
                      <TouchableOpacity
                        style={styles.actionIconCircle}
                        onPress={() => onEditItem(item)}
                        accessibilityLabel="Edit Report"
                      >
                        <Text style={styles.actionIconPencil}>✎</Text>
                      </TouchableOpacity>

                      {/* Withdraw Button */}
                      <TouchableOpacity
                        style={styles.actionIconCircle}
                        onPress={() => onWithdrawItem(item.id)}
                        accessibilityLabel="Withdraw Report"
                      >
                        <Text style={styles.actionIconCross}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* TAB 2: MY FOUND REPORTS */}
      {activitySubTab === 'found' && (
        <View style={styles.tabContentContainer}>
          {foundReports.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <View style={styles.emptyStateIconCircle}>
                <Text style={styles.emptyStateIconGlyph}>📦</Text>
              </View>
              <Text style={styles.emptyStateTitle}>You haven't reported any found items yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Help reunite items with their owners by reporting what you find.
              </Text>
              <TouchableOpacity
                style={styles.primaryCtaButton}
                onPress={() => onSwitchTab('report', 'hero_found')}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryCtaButtonText}>Report Found Item</Text>
              </TouchableOpacity>
            </View>
          ) : (
            foundReports.map((item: Item) => {
              const claimsNum = item.claims_count ?? 0;
              const displayStatus =
                item.status === 'Under Verification' ? 'Claim Pending' :
                item.status === 'Recovered' ? 'Handed Over' : 'Public';

              return (
                <View key={item.id} style={styles.activityCard}>
                  <View style={styles.cardHeaderRow}>
                    <Image
                      source={{ uri: item.image_url || SAMPLE_PHOTOS[1].url }}
                      style={styles.itemThumb}
                    />
                    <View style={styles.cardHeaderDetails}>
                      <Text style={styles.cardItemTitle} numberOfLines={1}>{item.title}</Text>

                      <View style={styles.statusBadgeRow}>
                        <View style={[
                          styles.statusDot,
                          item.status === 'Recovered' ? styles.dotGreen :
                          item.status === 'Under Verification' ? styles.dotAmber :
                          styles.dotGreen
                        ]} />
                        <Text style={styles.statusBadgeText}>{displayStatus}</Text>
                      </View>

                      <Text style={styles.cardMetaSub}>
                        {item.location} • {item.incident_date || 'Recently'}
                      </Text>
                    </View>
                  </View>

                  {/* Claims requests indicator */}
                  <View style={styles.indicatorPillRow}>
                    <View style={claimsNum > 0 ? styles.claimPillAmber : styles.claimPillMuted}>
                      <Text style={claimsNum > 0 ? styles.claimTextAmber : styles.claimTextMuted}>
                        {claimsNum > 0 ? `${claimsNum} people claimed this item` : 'No claim requests yet'}
                      </Text>
                    </View>
                  </View>

                  {/* Footer Actions */}
                  <View style={styles.cardFooterActions}>
                    <TouchableOpacity
                      style={claimsNum > 0 ? styles.actionPrimaryPillBtn : styles.actionSecondaryPillBtn}
                      onPress={() => {
                        if (claimsNum > 0) {
                          onReviewClaims(item);
                        } else {
                          onViewItemDetail(item);
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={claimsNum > 0 ? styles.actionPrimaryPillText : styles.actionSecondaryPillText}>
                        {claimsNum > 0 ? 'Review Claims' : 'View Report'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.actionIconGroup}>
                      <TouchableOpacity
                        style={styles.actionIconCircle}
                        onPress={() => onWithdrawItem(item.id)}
                        accessibilityLabel="Withdraw Report"
                      >
                        <Text style={styles.actionIconCross}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* TAB 3: MY MATCHES (WORKING QUEUE) */}
      {activitySubTab === 'matches' && (
        <View style={styles.tabContentContainer}>
          {matchesList.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <View style={styles.emptyStateIconCircle}>
                <Text style={styles.emptyStateIconGlyph}>⚡</Text>
              </View>
              <Text style={styles.emptyStateTitle}>No active matches right now</Text>
              <Text style={styles.emptyStateSubtext}>
                We'll notify you as soon as the system finds a possible match for your reports.
              </Text>
            </View>
          ) : (
            matchesList.map((match: MatchItem) => {
              const isHighVal = match.lost_item?.is_valuable || match.found_item?.is_valuable;
              const stageLabel =
                match.stage === 'handover_scheduled' ? 'Handover Scheduled' :
                match.stage === 'chat_open' ? 'Chat Open' : 'Verification Pending';

              return (
                <View key={match.id} style={styles.matchQueueCard}>
                  {/* Top Match Header: Similarity % + Stage Tag */}
                  <View style={styles.matchHeaderRow}>
                    <View style={styles.similarityScoreBadge}>
                      <Text style={styles.similarityScoreText}>{match.similarity_score}% Match</Text>
                    </View>
                    <View style={styles.stageTagBadge}>
                      <Text style={styles.stageTagText}>{stageLabel}</Text>
                    </View>
                  </View>

                  {/* Side-by-Side Comparison */}
                  <View style={styles.sideBySideContainer}>
                    <View style={styles.sideItemCol}>
                      <Image
                        source={{ uri: match.lost_item?.image_url || SAMPLE_PHOTOS[0].url }}
                        style={styles.sideThumb}
                      />
                      <Text style={styles.sideBadgeLost}>Your Lost Item</Text>
                      <Text style={styles.sideItemTitle} numberOfLines={1}>
                        {match.lost_item?.title || 'Lost Item'}
                      </Text>
                      <Text style={styles.sideItemLoc} numberOfLines={1}>
                        {match.lost_item?.location}
                      </Text>
                    </View>

                    <View style={styles.sideItemArrowCol}>
                      <Text style={styles.sideArrowGlyph}>↔</Text>
                    </View>

                    <View style={styles.sideItemCol}>
                      <Image
                        source={{ uri: match.found_item?.image_url || SAMPLE_PHOTOS[1].url }}
                        style={styles.sideThumb}
                      />
                      <Text style={styles.sideBadgeFound}>Matched Found Item</Text>
                      <Text style={styles.sideItemTitle} numberOfLines={1}>
                        {match.found_item?.title || 'Found Item'}
                      </Text>
                      <Text style={styles.sideItemLoc} numberOfLines={1}>
                        {match.found_item?.location}
                      </Text>
                    </View>
                  </View>

                  {/* High Value Staff Custody Guardrail */}
                  {isHighVal && (
                    <View style={styles.staffGuardrailNotice}>
                      <Text style={styles.staffGuardrailHeading}>Staff Contact Required</Text>
                      <Text style={styles.staffGuardrailBody}>
                        High-value item held at Campus Staff Helpdesk. Please verify identity with your student ID card.
                      </Text>
                    </View>
                  )}

                  {/* Action Button based on Stage */}
                  <View style={styles.matchFooterCol}>
                    {isHighVal ? (
                      <TouchableOpacity
                        style={styles.primaryBlackButton}
                        onPress={() => match.found_item && onStaffDeskContact(match.found_item)}
                        activeOpacity={0.88}
                      >
                        <Text style={styles.primaryBlackButtonText}>Staff Desk Contact</Text>
                      </TouchableOpacity>
                    ) : match.stage === 'chat_open' || match.stage === 'handover_scheduled' ? (
                      <TouchableOpacity
                        style={styles.primaryBlackButton}
                        onPress={() => match.found_item && onOpenMatchChat(match.found_item)}
                        activeOpacity={0.88}
                      >
                        <Text style={styles.primaryBlackButtonText}>Open Chat</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.primaryBlackButton}
                        onPress={() => match.found_item && onContinueMatchVerification(match.found_item)}
                        activeOpacity={0.88}
                      >
                        <Text style={styles.primaryBlackButtonText}>Continue Verification</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* TAB 4: RECOVERED / HISTORY */}
      {activitySubTab === 'history' && (
        <View style={styles.tabContentContainer}>
          {recoveredHistory.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <View style={styles.emptyStateIconCircle}>
                <Text style={styles.emptyStateIconGlyph}>✓</Text>
              </View>
              <Text style={styles.emptyStateTitle}>No recovered items yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Once an item is successfully returned, it'll show up here as a record.
              </Text>
            </View>
          ) : (
            recoveredHistory.map((item: Item) => {
              const originType = item.report_type === 'lost' ? 'Lost Report' : 'Found Report';
              return (
                <View key={item.id} style={styles.historyCard}>
                  <View style={styles.cardHeaderRow}>
                    <Image
                      source={{ uri: item.image_url || SAMPLE_PHOTOS[0].url }}
                      style={[styles.itemThumb, styles.thumbDimmed]}
                    />
                    <View style={styles.cardHeaderDetails}>
                      <View style={styles.historyBadgeRow}>
                        <View style={styles.recoveredClosedBadge}>
                          <Text style={styles.recoveredClosedBadgeText}>Recovered</Text>
                        </View>
                        <Text style={styles.historyOriginTag}>{originType}</Text>
                      </View>

                      <Text style={styles.cardItemTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.cardMetaSub}>
                        Recovered on {item.incident_date || 'Sep 2026'}
                      </Text>
                      <Text style={styles.matchedWithText} numberOfLines={1}>
                        Matched with: {item.reporter_name || 'Kongu Student'} ({item.reporter_role || 'Student'})
                      </Text>
                    </View>
                  </View>

                  <View style={styles.historyFooter}>
                    <TouchableOpacity
                      style={styles.viewSummaryButton}
                      onPress={() => onViewHistorySummary(item)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.viewSummaryButtonText}>View Summary</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  activityPageWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90,
  },

  // SECTION 1: Top Bar
  activityTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtnCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  backArrowGlyph: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  activityScreenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.3,
    fontFamily: 'Poppins-Bold',
  },
  topBarSpacer: {
    width: 38,
  },

  // SECTION 2: Stats Strip (4 equal-width white cards)
  statsStripRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statMiniCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  statMiniNum: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
    fontFamily: 'Poppins-Bold',
  },
  statMiniLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 2,
    textAlign: 'center',
    fontFamily: 'Poppins-Medium',
  },

  // SECTION 3: Sub-Tab Navigator (Fits all 4 tabs on mobile 375-390px)
  subTabNavigatorBar: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 22,
    padding: 4,
    gap: 4,
    marginBottom: 16,
  },
  subTabPill: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  subTabPillActive: {
    backgroundColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#777777',
    fontFamily: 'Poppins-Medium',
  },
  subTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
  },

  // SECTION 4: Tab Content Container
  tabContentContainer: {
    gap: 12,
  },

  // Cards
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8E8ED',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  itemThumb: {
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
    fontSize: 14.5,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 3,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotGreen: {
    backgroundColor: '#10B981',
  },
  dotAmber: {
    backgroundColor: '#F59E0B',
  },
  dotBlue: {
    backgroundColor: '#3B82F6',
  },
  dotRed: {
    backgroundColor: '#EF4444',
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#444444',
  },
  cardMetaSub: {
    fontSize: 11,
    color: '#8E8E93',
  },

  // Indicator Pills
  indicatorPillRow: {
    marginTop: 10,
    marginBottom: 10,
  },
  matchPillAmber: {
    backgroundColor: '#FFFBEB',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignSelf: 'flex-start',
  },
  matchTextAmber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  matchPillMuted: {
    backgroundColor: '#F9FAFB',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignSelf: 'flex-start',
  },
  matchTextMuted: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  claimPillAmber: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  claimTextAmber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  claimPillMuted: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  claimTextMuted: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Card Footer Actions
  cardFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  actionPrimaryPillBtn: {
    backgroundColor: '#000000',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  actionPrimaryPillText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  actionSecondaryPillBtn: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  actionSecondaryPillText: {
    color: '#333333',
    fontSize: 11.5,
    fontWeight: '700',
  },
  actionIconGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconPencil: {
    fontSize: 13,
    color: '#333',
  },
  actionIconCross: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '800',
  },

  // Empty State
  emptyStateBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8ED',
    marginTop: 8,
  },
  emptyStateIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyStateIconGlyph: {
    fontSize: 22,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyStateSubtext: {
    fontSize: 12.5,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    maxWidth: 280,
  },
  primaryCtaButton: {
    backgroundColor: '#000000',
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryCtaButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // Matches Queue Card
  matchQueueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  matchHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  similarityScoreBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  similarityScoreText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#065F46',
  },
  stageTagBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stageTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  sideBySideContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  sideItemCol: {
    flex: 1,
    minWidth: 0,
  },
  sideThumb: {
    width: '100%',
    height: 80,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#E5E5EA',
  },
  sideBadgeLost: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#EF4444',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  sideBadgeFound: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#10B981',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  sideItemTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 2,
  },
  sideItemLoc: {
    fontSize: 10.5,
    color: '#8E8E93',
  },
  sideItemArrowCol: {
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideArrowGlyph: {
    fontSize: 16,
    fontWeight: '800',
    color: '#9CA3AF',
  },
  staffGuardrailNotice: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 10,
  },
  staffGuardrailHeading: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#B45309',
    marginBottom: 2,
  },
  staffGuardrailBody: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 15,
  },
  matchFooterCol: {
    marginTop: 12,
  },
  primaryBlackButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryBlackButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },

  // History Card
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8E8ED',
  },
  historyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  recoveredClosedBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  recoveredClosedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  historyOriginTag: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#8E8E93',
  },
  matchedWithText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
    marginTop: 2,
  },
  historyFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  viewSummaryButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  viewSummaryButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111111',
  },
});
