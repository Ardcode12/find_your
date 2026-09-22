import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface ReportSectionProps {
  reportType: 'lost' | 'found';
  setReportType: (t: 'lost' | 'found') => void;
  reportTitle: string;
  setReportTitle: (t: string) => void;
  reportCategory: string;
  setReportCategory: (c: string) => void;
  reportDescription: string;
  setReportDescription: (d: string) => void;
  reportLocation: string;
  setReportLocation: (l: string) => void;
  reportCustomLocation: string;
  setReportCustomLocation: (l: string) => void;
  reportDate: string;
  setReportDate: (d: string) => void;
  reportTime: string;
  setReportTime: (t: string) => void;
  reportIsValuable: boolean;
  setReportIsValuable: (v: boolean) => void;
  reportPrivateDetail: string;
  setReportPrivateDetail: (p: string) => void;
  reportPhotos: string[];
  setReportPhotos: (p: string[]) => void;
  submittingReport: boolean;
  analyzingPhoto: boolean;
  onAnalyzePhoto: (sampleUrl: string) => void;
  onCreateReport: () => void;
  onBackToHome: () => void;
  categories: string[];
  locations: string[];
  samplePhotos: Array<{ label: string; url: string }>;
}

export default function ReportSection({
  reportType,
  setReportType,
  reportTitle,
  setReportTitle,
  reportCategory,
  setReportCategory,
  reportDescription,
  setReportDescription,
  reportLocation,
  setReportLocation,
  reportCustomLocation,
  setReportCustomLocation,
  reportDate,
  setReportDate,
  reportTime,
  setReportTime,
  reportIsValuable,
  setReportIsValuable,
  reportPrivateDetail,
  setReportPrivateDetail,
  reportPhotos,
  setReportPhotos,
  submittingReport,
  analyzingPhoto,
  onAnalyzePhoto,
  onCreateReport,
  onBackToHome,
  categories,
  locations,
  samplePhotos,
}: ReportSectionProps) {
  // Found items must take photo with camera only; Lost items can use gallery or camera
  const handleTakePhotoWithCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Camera access is required to capture live proof of the item on campus.'
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.6,
        base64: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setReportPhotos([dataUri]);
        onAnalyzePhoto(dataUri);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not open camera');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Gallery Permission Required',
          'Photo library access is needed to select a past photo of your lost belonging.'
        );
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.6,
        base64: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setReportPhotos([dataUri]);
        onAnalyzePhoto(dataUri);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not open gallery');
    }
  };

  // Auto-suggest high-value based on category
  const handleSelectCategory = (cat: string) => {
    setReportCategory(cat);
    if (['Electronics', 'Wallets', 'ID Cards', 'Bags'].includes(cat)) {
      setReportIsValuable(true);
    } else {
      setReportIsValuable(false);
    }
  };

  return (
    <View style={styles.reportPageWrapper}>
      {/* Top Bar */}
      <View style={styles.reportTopBar}>
        <TouchableOpacity
          style={styles.reportBackCircleBtn}
          onPress={onBackToHome}
          accessibilityLabel="Back to Home"
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnArrowText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.reportScreenTitle}>
          {reportType === 'lost' ? 'Report Lost Item' : 'Report Found Item'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Section 2: Type Toggle */}
      <View style={styles.reportTypeToggleContainer}>
        <TouchableOpacity
          style={[styles.reportTypeTab, reportType === 'lost' && styles.reportTypeTabActive]}
          onPress={() => setReportType('lost')}
          activeOpacity={0.8}
        >
          <Text style={[styles.reportTypeTabText, reportType === 'lost' && styles.reportTypeTabTextActive]}>
            I Lost Something
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.reportTypeTab, reportType === 'found' && styles.reportTypeTabActive]}
          onPress={() => setReportType('found')}
          activeOpacity={0.8}
        >
          <Text style={[styles.reportTypeTabText, reportType === 'found' && styles.reportTypeTabTextActive]}>
            I Found Something
          </Text>
        </TouchableOpacity>
      </View>

      {/* Photo Capture Section */}
      <View style={styles.formSectionCard}>
        <Text style={styles.sectionHeading}>Item Photograph</Text>

        {reportType === 'found' ? (
          <View style={{ marginVertical: 8 }}>
            <Text style={styles.sectionHelperText}>
              Found items require live camera capture only to prove physical possession on campus.
            </Text>
            <TouchableOpacity
              style={styles.actionCaptureCameraBtn}
              onPress={handleTakePhotoWithCamera}
              activeOpacity={0.85}
            >
              <Text style={styles.actionCaptureCameraBtnText}>Take Live Photo with Camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ marginVertical: 8 }}>
            <Text style={styles.sectionHelperText}>
              Upload a past photo from your phone gallery or take a picture of a similar item.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.actionCaptureCameraBtn, { flex: 1 }]}
                onPress={handlePickFromGallery}
                activeOpacity={0.85}
              >
                <Text style={styles.actionCaptureCameraBtnText}>Choose from Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionSecondaryBtn, { flex: 1 }]}
                onPress={handleTakePhotoWithCamera}
                activeOpacity={0.85}
              >
                <Text style={styles.actionSecondaryBtnText}>Use Camera</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Selected / Captured Image Preview */}
        {reportPhotos.length > 0 && reportPhotos[0] ? (
          <View style={styles.previewImageContainer}>
            <Image source={{ uri: reportPhotos[0] }} style={styles.previewImage} />
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={() => setReportPhotos([])}
              activeOpacity={0.8}
            >
              <Text style={styles.removeImageBtnText}>Remove Photo</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Demo Sample Photos fallback */}
        <Text style={[styles.sectionHelperText, { marginTop: 12, marginBottom: 4 }]}>
          Or select a sample campus asset:
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {samplePhotos.map((ph, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.samplePhotoThumbWrapper, reportPhotos[0] === ph.url && styles.samplePhotoThumbSelected]}
              onPress={() => {
                setReportPhotos([ph.url]);
                onAnalyzePhoto(ph.url);
              }}
              activeOpacity={0.8}
            >
              <Image source={{ uri: ph.url }} style={styles.samplePhotoThumb} />
              <Text style={styles.samplePhotoThumbLabel}>{ph.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {analyzingPhoto && (
          <View style={styles.aiAnalyzingPill}>
            <ActivityIndicator size="small" color="#000000" />
            <Text style={styles.aiAnalyzingPillText}>Vision Parser reading photo features...</Text>
          </View>
        )}
      </View>

      {/* Title & Category */}
      <View style={styles.formSectionCard}>
        <Text style={styles.fieldLabel}>Item Title *</Text>
        <TextInput
          style={styles.textInputField}
          placeholder="e.g. Kongu ID Card with Blue Lanyard"
          placeholderTextColor="#8E8E93"
          value={reportTitle}
          onChangeText={setReportTitle}
        />

        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Category *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
          {categories.filter((c) => c !== 'All').map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChoiceChip, reportCategory === cat && styles.categoryChoiceChipActive]}
              onPress={() => handleSelectCategory(cat)}
              activeOpacity={0.8}
            >
              <Text style={[styles.categoryChoiceChipText, reportCategory === cat && styles.categoryChoiceChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Detailed Description *</Text>
        <TextInput
          style={[styles.textInputField, { height: 75, textAlignVertical: 'top' }]}
          placeholder="Describe colors, engravings, brands, or distinguishing marks..."
          placeholderTextColor="#8E8E93"
          multiline
          value={reportDescription}
          onChangeText={setReportDescription}
        />
      </View>

      {/* Location & Time */}
      <View style={styles.formSectionCard}>
        <Text style={styles.fieldLabel}>Campus Location *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
          {locations.map((loc) => (
            <TouchableOpacity
              key={loc}
              style={[styles.categoryChoiceChip, reportLocation === loc && styles.categoryChoiceChipActive]}
              onPress={() => setReportLocation(loc)}
              activeOpacity={0.8}
            >
              <Text style={[styles.categoryChoiceChipText, reportLocation === loc && styles.categoryChoiceChipTextActive]}>
                {loc}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {reportLocation === 'Other' && (
          <TextInput
            style={[styles.textInputField, { marginTop: 8 }]}
            placeholder="Specify exact building, room, or laboratory..."
            placeholderTextColor="#8E8E93"
            value={reportCustomLocation}
            onChangeText={setReportCustomLocation}
          />
        )}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Incident Date</Text>
            <TextInput
              style={styles.textInputField}
              value={reportDate}
              onChangeText={setReportDate}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Approx. Time</Text>
            <TextInput
              style={styles.textInputField}
              value={reportTime}
              onChangeText={setReportTime}
            />
          </View>
        </View>
      </View>

      {/* Private Ownership Verification Detail */}
      <View style={styles.formSectionCard}>
        <Text style={styles.fieldLabel}>
          {reportType === 'lost' ? 'Secret Identifying Detail (Private)' : 'Hidden Feature for Claimant Verification'}
        </Text>
        <Text style={styles.sectionHelperText}>
          {reportType === 'lost'
            ? 'Only used by staff or system matcher to verify claimants (e.g. lock screen wallpaper, coin count, engraved initial).'
            : 'A detail you deliberately keep secret so only the true owner can claim it.'}
        </Text>
        <TextInput
          style={[styles.textInputField, { marginTop: 6 }]}
          placeholder="e.g. 50 rupee note inside back pocket"
          placeholderTextColor="#8E8E93"
          value={reportPrivateDetail}
          onChangeText={setReportPrivateDetail}
        />
      </View>

      {/* High-Value Toggle: YES/NO Switch */}
      <View style={styles.formSectionCard}>
        <Text style={styles.fieldLabel}>High-Value Asset Classification</Text>
        <Text style={styles.sectionHelperText}>
          Determines staff-mediated custody vs direct peer-to-peer handover downstream. Auto-suggested based on category.
        </Text>

        <View style={styles.highValueSwitchRow}>
          <TouchableOpacity
            style={[styles.highValueSwitchOption, reportIsValuable && styles.highValueSwitchOptionActiveYes]}
            onPress={() => setReportIsValuable(true)}
            activeOpacity={0.85}
          >
            <Text style={[styles.highValueSwitchOptionText, reportIsValuable && styles.highValueSwitchOptionTextActive]}>
              YES — High-Value Asset
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.highValueSwitchOption, !reportIsValuable && styles.highValueSwitchOptionActiveNo]}
            onPress={() => setReportIsValuable(false)}
            activeOpacity={0.85}
          >
            <Text style={[styles.highValueSwitchOptionText, !reportIsValuable && styles.highValueSwitchOptionTextActive]}>
              NO — Standard Belonging
            </Text>
          </TouchableOpacity>
        </View>

        {reportIsValuable ? (
          <View style={styles.routingNoticeBox}>
            <Text style={styles.routingNoticeHeading}>Staff-Mediated Handover Required</Text>
            <Text style={styles.routingNoticeText}>
              This item will be routed through the Non-teaching Staff Desk / Security Office. Direct peer chat is replaced with an official Staff Custody Notice to protect high-value campus property.
            </Text>
          </View>
        ) : (
          <View style={styles.routingNoticeBoxPeer}>
            <Text style={styles.routingNoticeHeadingPeer}>Direct Peer-to-Peer Handover</Text>
            <Text style={styles.routingNoticeTextPeer}>
              Standard items allow in-app messaging once verification succeeds, enabling finder and claimant to coordinate a direct return.
            </Text>
          </View>
        )}
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitReportLargeBtn, submittingReport && styles.submitReportLargeBtnDisabled]}
        onPress={onCreateReport}
        disabled={submittingReport}
        activeOpacity={0.88}
      >
        {submittingReport ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitReportLargeBtnText}>
            {reportType === 'lost' ? 'File Lost Report & Scan Matches' : 'Publish Found Item to Campus'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  reportPageWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90,
  },
  reportTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  reportBackCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnArrowText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  reportScreenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
  },
  reportTypeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 6,
  },
  reportTypeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  reportTypeTabActive: {
    backgroundColor: '#000000',
  },
  reportTypeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
  reportTypeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  formSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8E8ED',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 4,
  },
  sectionHelperText: {
    fontSize: 11.5,
    color: '#8E8E93',
    lineHeight: 16,
  },
  samplePhotoThumbWrapper: {
    marginRight: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    alignItems: 'center',
  },
  samplePhotoThumbSelected: {
    borderColor: '#000000',
  },
  samplePhotoThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
  },
  samplePhotoThumbLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#333333',
    marginTop: 4,
  },
  aiAnalyzingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
    marginTop: 6,
  },
  aiAnalyzingPillText: {
    fontSize: 11.5,
    color: '#1E40AF',
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
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
  categoryChoiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    marginRight: 6,
  },
  categoryChoiceChipActive: {
    backgroundColor: '#000000',
  },
  categoryChoiceChipText: {
    fontSize: 11.5,
    color: '#666666',
    fontWeight: '600',
  },
  categoryChoiceChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  actionCaptureCameraBtn: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  actionCaptureCameraBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  actionSecondaryBtn: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  actionSecondaryBtnText: {
    color: '#111111',
    fontSize: 12.5,
    fontWeight: '700',
  },
  previewImageContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  previewImage: {
    width: 140,
    height: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  removeImageBtn: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  removeImageBtnText: {
    color: '#991B1B',
    fontSize: 11,
    fontWeight: '700',
  },
  highValueSwitchRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  highValueSwitchOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  highValueSwitchOptionActiveYes: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  highValueSwitchOptionActiveNo: {
    backgroundColor: '#F3F4F6',
    borderColor: '#111111',
  },
  highValueSwitchOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  highValueSwitchOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  routingNoticeBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  routingNoticeHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 2,
  },
  routingNoticeText: {
    fontSize: 11,
    color: '#B45309',
    lineHeight: 15,
  },
  routingNoticeBoxPeer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  routingNoticeHeadingPeer: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 2,
  },
  routingNoticeTextPeer: {
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 15,
  },
  submitReportLargeBtn: {
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  submitReportLargeBtnDisabled: {
    opacity: 0.6,
  },
  submitReportLargeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
