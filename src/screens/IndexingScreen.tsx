/**
 * IndexingScreen
 * 
 * "Dreaming" phase UI that shows:
 * - Model selector dropdown for vision model
 * - Full-screen progress indicator
 * - Current phase with animated visuals
 * - File summary (no scrolling, fits on screen)
 * - Cancel option (before processing starts)
 * - Nothing OS aesthetic
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { THEME, type VisionModelOption } from '../constants/config';
import type { SelectedFile, ProcessingProgress } from '../types';

interface IndexingScreenProps {
  progress: ProcessingProgress;
  selectedFiles: SelectedFile[];
  isIndexing: boolean;
  onStartIndexing: () => void;
  onCancel: () => void;
  // Model selection
  availableModels: VisionModelOption[];
  selectedModel: string;
  onModelSelect: (modelSlug: string) => void;
  // Error state
  error?: string | null;
}

export const IndexingScreen: React.FC<IndexingScreenProps> = ({
  progress,
  selectedFiles,
  isIndexing,
  onStartIndexing,
  onCancel,
  availableModels,
  selectedModel,
  onModelSelect,
  error,
}) => {
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const imageCount = useMemo(
    () => selectedFiles.filter((f) => f.type === 'image').length,
    [selectedFiles]
  );

  const pdfCount = useMemo(
    () => selectedFiles.filter((f) => f.type === 'pdf').length,
    [selectedFiles]
  );

  const selectedModelInfo = useMemo(
    () => availableModels.find((m) => m.slug === selectedModel) || availableModels[0],
    [availableModels, selectedModel]
  );

  const canCancel = !isIndexing || progress.phase === 'selecting' || progress.phase === 'error';
  const canStart = !isIndexing && selectedFiles.length > 0 && progress.phase !== 'complete';
  const hasError = progress.phase === 'error' || !!error;
  const isComplete = progress.phase === 'complete';

  // Parse error message to show user-friendly text
  const getErrorDisplay = () => {
    const errorMsg = error || progress.message;
    if (errorMsg?.includes('Unable to resolve host') || errorMsg?.includes('No address associated')) {
      return 'Network error: Cannot download model. Check your internet connection and try again.';
    }
    if (errorMsg?.includes('Failed to download')) {
      return 'Download failed. Please check your internet connection.';
    }
    return errorMsg || 'An error occurred';
  };

  const handleModelSelect = (modelSlug: string) => {
    onModelSelect(modelSlug);
    setDropdownVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onCancel}
          disabled={isIndexing && !canCancel}
        >
          <Text style={[
            styles.backButtonText,
            isIndexing && !canCancel && styles.backButtonDisabled,
          ]}>
            {canCancel ? '< Back' : 'Processing...'}
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.title}>
          {hasError ? 'Error' : isComplete ? 'Complete' : isIndexing ? 'Dreaming...' : 'Ready to Index'}
        </Text>
      </View>

      {/* Main Content - No Scrolling */}
      <View style={styles.content}>
        {/* Error Display */}
        {hasError && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Failed to Index</Text>
            <Text style={styles.errorMessage}>{getErrorDisplay()}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={onStartIndexing}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Completion UI */}
        {isComplete && !hasError && (
          <View style={styles.completeContainer}>
            <Text style={styles.completeText}>
              All files have been indexed successfully
            </Text>
            <Text style={styles.completeSubtext}>
              {progress.total} {progress.total === 1 ? 'file' : 'files'} added to your memory
            </Text>
          </View>
        )}

        {/* Progress Indicator (when indexing) */}
        {isIndexing && !hasError && !isComplete && (
          <ProgressIndicator progress={progress} />
        )}

        {/* Pre-indexing UI */}
        {!isIndexing && !hasError && !isComplete && (
          <>
            {/* File Summary - Compact */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{imageCount}</Text>
                  <Text style={styles.summaryLabel}>Images</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{pdfCount}</Text>
                  <Text style={styles.summaryLabel}>PDFs</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{selectedFiles.length}</Text>
                  <Text style={styles.summaryLabel}>Total</Text>
                </View>
              </View>
            </View>

            {/* Model Selector Dropdown */}
            {imageCount > 0 && (
              <View style={styles.dropdownSection}>
                <Text style={styles.dropdownLabel}>Vision Model</Text>
                <TouchableOpacity
                  style={styles.dropdown}
                  onPress={() => setDropdownVisible(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dropdownContent}>
                    <Text style={styles.dropdownText}>{selectedModelInfo.name}</Text>
                    <Text style={styles.dropdownSubtext}>
                      {selectedModelInfo.sizeMb} MB
                    </Text>
                  </View>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Info Text */}
            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>
                Files will be processed entirely on-device.{'\n'}
                Nothing leaves your phone.
              </Text>
            </View>
          </>
        )}

        {/* Indexing Info */}
        {isIndexing && !hasError && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              Processing files locally on your device.{'\n'}
              This may take a few minutes.
            </Text>
          </View>
        )}
      </View>

      {/* Action Button */}
      <View style={styles.actionContainer}>
        {canStart && !hasError && (
          <TouchableOpacity
            style={styles.startButton}
            onPress={onStartIndexing}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonText}>Start Indexing</Text>
          </TouchableOpacity>
        )}

        {progress.phase === 'complete' && (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={onCancel}
            activeOpacity={0.8}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Model Selection Modal */}
      <Modal
        visible={dropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDropdownVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Vision Model</Text>
            <FlatList
              data={availableModels}
              keyExtractor={(item) => item.slug}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    selectedModel === item.slug && styles.modalOptionSelected,
                  ]}
                  onPress={() => handleModelSelect(item.slug)}
                >
                  <View style={styles.modalOptionHeader}>
                    <Text style={[
                      styles.modalOptionName,
                      selectedModel === item.slug && styles.modalOptionNameSelected,
                    ]}>
                      {item.name}
                    </Text>
                    {item.recommended && (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedText}>Recommended</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.modalOptionSize}>{item.sizeMb} MB</Text>
                  <Text style={styles.modalOptionDesc}>{item.description}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: THEME.accent,
    fontFamily: 'monospace',
  },
  backButtonDisabled: {
    color: THEME.textMuted,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: THEME.text,
    fontFamily: 'monospace',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  // Error styles
  errorCard: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: THEME.error,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: THEME.error,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontFamily: 'monospace',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: THEME.accent,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME.text,
    fontFamily: 'monospace',
  },
  // Complete state
  completeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  completeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: THEME.text,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: 12,
  },
  completeSubtext: {
    fontSize: 16,
    color: THEME.textSecondary,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  // Summary card
  summaryCard: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  summaryNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: THEME.text,
    fontFamily: 'monospace',
  },
  summaryLabel: {
    fontSize: 12,
    color: THEME.textMuted,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: THEME.border,
  },
  // Dropdown styles
  dropdownSection: {
    marginBottom: 20,
  },
  dropdownLabel: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  dropdown: {
    backgroundColor: THEME.surface,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownContent: {
    flex: 1,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME.text,
    fontFamily: 'monospace',
  },
  dropdownSubtext: {
    fontSize: 12,
    color: THEME.textMuted,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  dropdownArrow: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginLeft: 8,
  },
  // Info text
  infoContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  infoText: {
    fontSize: 14,
    color: THEME.textMuted,
    fontFamily: 'monospace',
    textAlign: 'center',
    lineHeight: 22,
  },
  // Action buttons
  actionContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  startButton: {
    backgroundColor: THEME.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.text,
    fontFamily: 'monospace',
  },
  doneButton: {
    backgroundColor: THEME.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.text,
    fontFamily: 'monospace',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: THEME.surface,
    borderRadius: 16,
    padding: 20,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.text,
    fontFamily: 'monospace',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    backgroundColor: THEME.surfaceLight,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  modalOptionSelected: {
    borderColor: THEME.accent,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
  },
  modalOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalOptionName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: THEME.text,
    fontFamily: 'monospace',
  },
  modalOptionNameSelected: {
    color: THEME.accent,
  },
  modalOptionSize: {
    fontSize: 11,
    color: THEME.textMuted,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  modalOptionDesc: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontFamily: 'monospace',
  },
  recommendedBadge: {
    backgroundColor: THEME.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  recommendedText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: THEME.text,
    fontFamily: 'monospace',
  },
});
