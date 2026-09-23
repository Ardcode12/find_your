import React, { useState, useEffect, useRef } from 'react';
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
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { transcribeVoiceAudio, transcribeVoiceFile } from '@/services/api';





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
  samplePhotos?: Array<{ label: string; url: string }>;
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
  // Voice Recording with expo-audio & Whisper Large V3
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribingVoice, setTranscribingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  // Live Location state
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [liveLocationInfo, setLiveLocationInfo] = useState<string | null>(null);

  // Cleanup audio recording on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Handle Voice Input Toggle (Start / Stop & Transcribe with Whisper Large V3)
  const handleToggleVoiceRecording = async () => {
    if (isRecording) {
      // STOP RECORDING & TRANSCRIBE
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      setTranscribingVoice(true);
      setVoiceNotice('Whisper Large V3 is transcribing your voice...');

      try {
        await audioRecorder.stop();
        const uri = audioRecorder.uri;

        if (!uri) {
          throw new Error('Could not retrieve audio recording file URI');
        }

        // Wait for the file to be fully written to disk by the native module (poll size)
        let fileSize = 0;
        let retries = 10;
        while (retries > 0) {
          const fileInfo = await FileSystem.getInfoAsync(uri);
          fileSize = (fileInfo as any).size ?? 0;
          if (fileSize > 100) break; // Arbitrary threshold indicating it's not empty
          await new Promise((resolve) => setTimeout(resolve, 250));
          retries--;
        }

        if (fileSize <= 100) {
          throw new Error(`Recording too short or empty (${fileSize} bytes). Please record for at least 1 second.`);
        }

        console.log(`[VOICE] Recording ready: ${uri}, size: ${fileSize} bytes`);

        // Upload as multipart (primary) — most reliable on mobile
        let resp: any = null;
        try {
          resp = await transcribeVoiceFile(uri, 'en');
        } catch (uploadErr) {
          console.warn('[VOICE] Multipart upload failed, trying base64 fallback:', uploadErr);
          // Fallback: read as base64 and send via JSON endpoint
          const base64Audio = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (!base64Audio || base64Audio.length < 50) {
            throw new Error('Could not read audio file for transcription');
          }
          resp = await transcribeVoiceAudio(base64Audio, 'en');
        }

        if (resp && resp.text && resp.text.trim()) {
          const transcribedEnglish = resp.text.trim();
          const updatedDescription =
            reportDescription && reportDescription.trim()
              ? `${reportDescription.trim()} ${transcribedEnglish}`
              : transcribedEnglish;
          setReportDescription(updatedDescription);
          setVoiceNotice('✨ Voice transcribed into English via Whisper Large V3');
          setTimeout(() => setVoiceNotice(null), 5000);
        } else {
          setVoiceNotice('No speech detected. Please speak closer to the microphone and try again.');
          setTimeout(() => setVoiceNotice(null), 4000);
        }
      } catch (err: any) {
        Alert.alert(
          'Voice Transcription Error',
          err.message || 'Could not process audio. Please type your description manually.'
        );
        setVoiceNotice(null);
      } finally {
        setTranscribingVoice(false);
      }
    } else {
      // START RECORDING
      try {
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            'Microphone Permission Required',
            'Please allow microphone access to speak your item description.'
          );
          return;
        }

        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();

        setIsRecording(true);
        setRecordingDuration(0);
        setVoiceNotice('🎙️ Listening in English... Tap Stop when finished speaking.');

        timerRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
      } catch (err: any) {
        Alert.alert('Recording Error', err.message || 'Could not start audio recording');
      }
    }
  };



  // Handle Live Location Capture
  const handleGetLiveLocation = async () => {
    try {
      setFetchingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Permission to access device location is needed to automatically pin your live campus coordinates.'
        );
        setFetchingLocation(false);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = pos.coords;
      let detectedSpot = `GPS (${latitude.toFixed(5)}° N, ${longitude.toFixed(5)}° E)`;

      try {
        const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocoded && geocoded.length > 0) {
          const g = geocoded[0];
          const parts = [g.name, g.street, g.district || g.subregion, g.city].filter(Boolean);
          if (parts.length > 0) {
            detectedSpot = `${parts.join(', ')} • ${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`;
          }
        }
      } catch (geoErr) {
        // use coordinates
      }

      setLiveLocationInfo(detectedSpot);
      setReportCustomLocation(detectedSpot);
      if (locations.includes('Other')) {
        setReportLocation('Other');
      }
    } catch (err: any) {
      Alert.alert('Location Error', err.message || 'Could not fetch current live location');
    } finally {
      setFetchingLocation(false);
    }
  };

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
        allowsEditing: false,
        quality: 0.8,
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
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
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

        {/* AI Vision analysis status pill */}
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

        <View style={styles.fieldHeaderRow}>
          <Text style={styles.fieldLabel}>Detailed Description *</Text>
          {transcribingVoice ? (
            <View style={styles.voiceMicBtnLoading}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.voiceMicBtnTextLoading}>Transcribing...</Text>
            </View>
          ) : isRecording ? (
            <TouchableOpacity
              style={styles.voiceMicBtnRecording}
              onPress={handleToggleVoiceRecording}
              activeOpacity={0.8}
            >
              <View style={styles.recordingPulseDot} />
              <Text style={styles.voiceMicBtnTextRecording}>
                Stop {recordingDuration > 0 ? `(${recordingDuration}s)` : ''}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.voiceMicBtnIdle}
              onPress={handleToggleVoiceRecording}
              activeOpacity={0.8}
            >
              <Text style={styles.voiceMicBtnTextIdle}>🎙️ Speak Description</Text>
            </TouchableOpacity>
          )}
        </View>

        {voiceNotice ? (
          <View style={[styles.voiceNoticeBox, isRecording && styles.voiceNoticeBoxRecording]}>
            <Text style={[styles.voiceNoticeText, isRecording && styles.voiceNoticeTextRecording]}>
              {voiceNotice}
            </Text>
          </View>
        ) : null}

        <TextInput
          style={[styles.textInputField, { height: 75, textAlignVertical: 'top' }]}
          placeholder="Describe colors, engravings, brands, or distinguishing marks (or tap 🎙️ above)..."
          placeholderTextColor="#8E8E93"
          multiline
          value={reportDescription}
          onChangeText={setReportDescription}
        />
      </View>

      {/* Location & Time */}
      <View style={styles.formSectionCard}>
        <View style={styles.fieldHeaderRow}>
          <Text style={styles.fieldLabel}>Campus Location *</Text>
          <TouchableOpacity
            style={styles.liveLocationBtn}
            onPress={handleGetLiveLocation}
            disabled={fetchingLocation}
            activeOpacity={0.8}
          >
            {fetchingLocation ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ActivityIndicator size="small" color="#000000" />
                <Text style={styles.liveLocationBtnText}>Locating...</Text>
              </View>
            ) : (
              <Text style={styles.liveLocationBtnText}>📍 Use Live Location</Text>
            )}
          </TouchableOpacity>
        </View>

        {liveLocationInfo ? (
          <View style={styles.liveLocationBadge}>
            <Text style={styles.liveLocationBadgeText} numberOfLines={2}>
              📍 {liveLocationInfo}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setLiveLocationInfo(null);
                setReportCustomLocation('');
              }}
              style={styles.liveLocationClearBtn}
            >
              <Text style={styles.liveLocationClearBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}

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
    fontFamily: 'Poppins-Bold',
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
    fontFamily: 'Poppins-Medium',
  },
  reportTypeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
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
    fontFamily: 'Poppins-Bold',
  },
  sectionHelperText: {
    fontSize: 11.5,
    color: '#8E8E93',
    lineHeight: 16,
    fontFamily: 'Poppins-Regular',
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
    fontFamily: 'Poppins-Medium',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
    fontFamily: 'Poppins-SemiBold',
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
    fontFamily: 'Poppins-Regular',
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
    fontFamily: 'Poppins-Medium',
  },
  categoryChoiceChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
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
    fontFamily: 'Poppins-SemiBold',
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
    fontFamily: 'Poppins-SemiBold',
  },
  previewImageContainer: {
    marginVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  previewImage: {
    width: '100%',
    height: 240,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#0F172A',
    resizeMode: 'contain',
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
    fontFamily: 'Poppins-SemiBold',
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
    fontFamily: 'Poppins-Medium',
  },
  highValueSwitchOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontFamily: 'Poppins-Bold',
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
    fontFamily: 'Poppins-Bold',
  },
  routingNoticeText: {
    fontSize: 11,
    color: '#B45309',
    lineHeight: 15,
    fontFamily: 'Poppins-Regular',
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
    fontFamily: 'Poppins-Bold',
  },
  routingNoticeTextPeer: {
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 15,
    fontFamily: 'Poppins-Regular',
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
    fontFamily: 'Poppins-Bold',
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  voiceMicBtnIdle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  voiceMicBtnTextIdle: {
    fontSize: 11,
    color: '#000000',
    fontFamily: 'Poppins-SemiBold',
  },
  voiceMicBtnRecording: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  voiceMicBtnTextRecording: {
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: 'Poppins-Bold',
  },
  recordingPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  voiceMicBtnLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  voiceMicBtnTextLoading: {
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: 'Poppins-Medium',
  },
  voiceNoticeBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },
  voiceNoticeBoxRecording: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  voiceNoticeText: {
    fontSize: 11,
    color: '#1D4ED8',
    fontFamily: 'Poppins-Medium',
  },
  voiceNoticeTextRecording: {
    color: '#DC2626',
    fontFamily: 'Poppins-SemiBold',
  },
  liveLocationBtn: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  liveLocationBtnText: {
    fontSize: 11,
    color: '#000000',
    fontFamily: 'Poppins-SemiBold',
  },
  liveLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
    marginTop: 2,
  },
  liveLocationBadgeText: {
    flex: 1,
    fontSize: 11,
    color: '#065F46',
    fontFamily: 'Poppins-Medium',
  },
  liveLocationClearBtn: {
    marginLeft: 6,
    padding: 2,
  },
  liveLocationClearBtnText: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '700',
  },
});

