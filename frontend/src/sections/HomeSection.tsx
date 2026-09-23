import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Item } from '@/services/api';

const SAMPLE_PHOTOS = [
  { label: 'Wallet', url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80' },
  { label: 'Sneakers', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80' },
  { label: 'ID Card', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80' },
  { label: 'Electronics', url: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=600&q=80' },
  { label: 'Keys', url: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80' },
  { label: 'Tote Bag', url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80' },
];

interface HomeSectionProps {
  stats: { found_items: number; lost_reports: number; recovered: number; matched: number };
  items: Item[];
  loading: boolean;
  search: string;
  setSearch: (text: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  selectedLocation: string;
  setSelectedLocation: (loc: string) => void;
  categories: string[];
  locations: string[];
  onSwitchTab: (tab: 'home' | 'report' | 'activity' | 'notifications' | 'profile', source?: any) => void;
  onSelectItem: (item: Item) => void;
}

export default function HomeSection({
  stats,
  items,
  loading,
  search,
  setSearch,
  selectedCategory,
  setSelectedCategory,
  selectedLocation,
  setSelectedLocation,
  categories,
  locations,
  onSwitchTab,
  onSelectItem,
}: HomeSectionProps) {
  // Ensure unique categories and locations with 'All' at index 0 and no duplicate keys
  const cleanCategories = useMemo(() => {
    const raw = categories || [];
    const set = new Set(raw);
    const list = Array.from(set).filter((c) => c !== 'All');
    return ['All', ...list];
  }, [categories]);

  const cleanLocations = useMemo(() => {
    const raw = locations || [];
    const set = new Set(raw);
    const list = Array.from(set).filter((l) => l !== 'All');
    return ['All', ...list];
  }, [locations]);

  // Filter items based on category, location, and search
  const filteredHomeItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Hide lost reports from public home feed (they are private)
      if (item.report_type === 'lost') return false;

      // 2. Category filter
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }

      // 3. Location filter
      if (selectedLocation !== 'All' && item.location !== selectedLocation) {
        return false;
      }

      // 4. Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const inTitle = item.title.toLowerCase().includes(q);
        const inDesc = item.description.toLowerCase().includes(q);
        const inLoc = item.location.toLowerCase().includes(q);
        if (!inTitle && !inDesc && !inLoc) return false;
      }

      return true;
    });
  }, [items, selectedCategory, selectedLocation, search]);

  return (
    <View style={styles.homeContainer}>
      {/* Hero Banner */}
      <View style={styles.heroCard}>
        <View style={styles.heroBadgeRow}>
          <View style={styles.heroLivePill}>
            <View style={styles.greenPulseDot} />
            <Text style={styles.heroLivePillText}>Campus Safe Registry</Text>
          </View>
          <Text style={styles.heroDateText}>Fall 2026 Session</Text>
        </View>

        <Text style={styles.heroHeadline}>Reuniting Lost Belongings with Kongu Students.</Text>
        <Text style={styles.heroSubtext}>
          File private lost reports, browse verified campus finds, and match belongings securely with staff-assisted verification.
        </Text>

        <View style={styles.heroActionButtonsRow}>
          <TouchableOpacity
            style={styles.heroLostButton}
            onPress={() => onSwitchTab('report', 'hero_lost')}
            activeOpacity={0.85}
          >
            <Text style={styles.heroLostButtonText}>Report Lost Item</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.heroFoundButton}
            onPress={() => onSwitchTab('report', 'hero_found')}
            activeOpacity={0.85}
          >
            <Text style={styles.heroFoundButtonText}>Report Found Item</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 4 Summary Counters */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.found_items}</Text>
          <Text style={styles.statLabel}>Found Items</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.lost_reports}</Text>
          <Text style={styles.statLabel}>Lost Reports</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.matched}</Text>
          <Text style={styles.statLabel}>Active Matches</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.recovered}</Text>
          <Text style={styles.statLabel}>Recovered</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBarInner}>
          <View style={styles.searchIconSymbol}>
            <View style={styles.searchGlassCircle} />
            <View style={styles.searchGlassHandle} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by item name, room, or description..."
            placeholderTextColor="#8E8E93"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.searchClearGlyph}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Categories Horizontal Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScrollList}
      >
        {cleanCategories.map((cat, idx) => {
          const isActive = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={`cat-${cat}-${idx}`}
              style={[styles.categoryPill, isActive && styles.categoryPillActive]}
              onPress={() => setSelectedCategory(cat)}
              activeOpacity={0.8}
            >
              <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Location Chips Strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.locationScrollList}
      >
        {cleanLocations.map((loc, idx) => {
          const isActive = selectedLocation === loc;
          return (
            <TouchableOpacity
              key={`loc-${loc}-${idx}`}
              style={[styles.locationChip, isActive && styles.locationChipActive]}
              onPress={() => setSelectedLocation(loc)}
              activeOpacity={0.8}
            >
              <Text style={[styles.locationChipText, isActive && styles.locationChipTextActive]}>
                {loc}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Feed Header */}
      <View style={styles.feedHeaderRow}>
        <Text style={styles.feedHeaderTitle}>
          {selectedCategory === 'All' ? 'Recent Campus Belongings' : `${selectedCategory} on Campus`}
        </Text>
        <Text style={styles.feedHeaderCount}>{filteredHomeItems.length} items</Text>
      </View>

      {/* Items Feed Grid */}
      {loading ? (
        <View style={styles.feedLoadingBox}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.feedLoadingText}>Loading campus belongings...</Text>
        </View>
      ) : filteredHomeItems.length === 0 ? (
        <View style={styles.emptyFeedBox}>
          <Text style={styles.emptyFeedTitle}>No items match your search</Text>
          <Text style={styles.emptyFeedSub}>
            Try clearing filters or search terms, or file a private lost report so our auto-matcher alerts you.
          </Text>
        </View>
      ) : (
        <View style={styles.itemsGrid}>
          {filteredHomeItems.map((item) => {
            const isLost = item.report_type === 'lost';
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.itemCard}
                onPress={() => onSelectItem(item)}
                activeOpacity={0.88}
              >
                <View style={styles.itemCardImageWrapper}>
                  <Image
                    source={{ uri: item.image_url || SAMPLE_PHOTOS[0].url }}
                    style={styles.itemCardImage}
                  />
                  <View style={styles.itemCardPillsContainer}>
                    <View style={[styles.typeBadgePill, isLost ? styles.typeBadgeLost : styles.typeBadgeFound]}>
                      <Text style={styles.typeBadgeText}>{isLost ? 'LOST' : 'FOUND'}</Text>
                    </View>
                    {item.is_valuable && (
                      <View style={styles.highValPill}>
                        <Text style={styles.highValPillText}>SECURE DESK</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.itemCardBody}>
                  <Text style={styles.itemCardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.itemCardLocation} numberOfLines={1}>
                    {item.location} • {item.incident_date || 'Recently'}
                  </Text>
                  <Text style={styles.itemCardSnippet} numberOfLines={2}>
                    {item.description}
                  </Text>

                  <View style={styles.itemCardFooter}>
                    <View style={styles.statusIndicatorWrapper}>
                      <View style={[
                        styles.statusDot,
                        item.status === 'Recovered' ? styles.dotGreen :
                        item.status === 'Under Verification' ? styles.dotBlue :
                        item.status === 'Matched' ? styles.dotAmber :
                        styles.dotGreen
                      ]} />
                      <Text style={styles.statusTextLabel}>{item.status}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.cardDetailBtn}
                      onPress={() => onSelectItem(item)}
                    >
                      <Text style={styles.cardDetailBtnText}>Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  homeContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90,
  },
  heroCard: {
    backgroundColor: '#000000',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heroLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  heroLivePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Poppins-Bold',
  },
  heroDateText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Poppins-Medium',
  },
  heroHeadline: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 26,
    marginBottom: 8,
    fontFamily: 'Poppins-Bold',
  },
  heroSubtext: {
    color: '#A1A1AA',
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 16,
    fontFamily: 'Poppins-Regular',
  },
  heroActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroLostButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  heroLostButtonText: {
    color: '#000000',
    fontSize: 12.5,
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
  },
  heroFoundButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  heroFoundButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  statNumber: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
    fontFamily: 'Poppins-Bold',
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 2,
    textAlign: 'center',
    fontFamily: 'Poppins-Medium',
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    gap: 8,
  },
  searchIconSymbol: {
    width: 16,
    height: 16,
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
    bottom: 0,
    right: 1,
    width: 6,
    height: 1.5,
    backgroundColor: '#8E8E93',
    transform: [{ rotate: '45deg' }],
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111111',
    padding: 0,
    fontFamily: 'Poppins-Regular',
  },
  searchClearGlyph: {
    fontSize: 13,
    color: '#8E8E93',
    paddingHorizontal: 4,
  },
  categoryScrollList: {
    gap: 8,
    marginBottom: 10,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
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
    fontFamily: 'Poppins-Medium',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
  },
  locationScrollList: {
    gap: 6,
    marginBottom: 16,
  },
  locationChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F2F2F7',
  },
  locationChipActive: {
    backgroundColor: '#111111',
  },
  locationChipText: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '600',
    fontFamily: 'Poppins-Medium',
  },
  locationChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
  },
  feedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
    fontFamily: 'Poppins-Bold',
  },
  feedHeaderCount: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    fontFamily: 'Poppins-Medium',
  },
  feedLoadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  feedLoadingText: {
    fontSize: 12.5,
    color: '#8E8E93',
    marginTop: 10,
    fontFamily: 'Poppins-Regular',
  },
  emptyFeedBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8ED',
  },
  emptyFeedTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 6,
    fontFamily: 'Poppins-Bold',
  },
  emptyFeedSub: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'Poppins-Regular',
  },
  itemsGrid: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E8ED',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  itemCardImageWrapper: {
    width: '100%',
    height: 160,
    position: 'relative',
    backgroundColor: '#F2F2F7',
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
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeLost: {
    backgroundColor: '#EF4444',
  },
  typeBadgeFound: {
    backgroundColor: '#10B981',
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'Poppins-Bold',
  },
  highValPill: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  highValPillText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
    fontFamily: 'Poppins-Bold',
  },
  itemCardBody: {
    padding: 12,
  },
  itemCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 2,
    fontFamily: 'Poppins-Bold',
  },
  itemCardLocation: {
    fontSize: 11.5,
    color: '#8E8E93',
    marginBottom: 6,
    fontFamily: 'Poppins-Regular',
  },
  itemCardSnippet: {
    fontSize: 12,
    color: '#555555',
    lineHeight: 16,
    marginBottom: 10,
    fontFamily: 'Poppins-Regular',
  },
  itemCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  statusIndicatorWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  statusTextLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#444',
    fontFamily: 'Poppins-SemiBold',
  },
  cardDetailBtn: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  cardDetailBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#111111',
    fontFamily: 'Poppins-SemiBold',
  },
});
