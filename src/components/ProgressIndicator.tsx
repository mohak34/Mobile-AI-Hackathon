/**
 * ProgressIndicator Component
 * 
 * Displays indexing progress with:
 * - Bouncing dots animation (Nothing OS style)
 * - Phase indicator
 * - Status message
 * - Nothing OS "Dreaming" aesthetic
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { THEME } from '../constants/config';
import type { ProcessingProgress } from '../types';

interface ProgressIndicatorProps {
  progress: ProcessingProgress;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
}) => {
  // Bouncing dots animations
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;
  const dot4Anim = useRef(new Animated.Value(0)).current;
  const dot5Anim = useRef(new Animated.Value(0)).current;

  // Bouncing dots animation
  useEffect(() => {
    if (progress.phase !== 'idle' && progress.phase !== 'complete' && progress.phase !== 'error') {
      const createBounce = (anim: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 250,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 250,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true,
            }),
            // Wait for all dots to finish before restarting
            Animated.delay(1000 - delay),
          ])
        );
      };

      const anim1 = createBounce(dot1Anim, 0);
      const anim2 = createBounce(dot2Anim, 120);
      const anim3 = createBounce(dot3Anim, 240);
      const anim4 = createBounce(dot4Anim, 360);
      const anim5 = createBounce(dot5Anim, 480);

      anim1.start();
      anim2.start();
      anim3.start();
      anim4.start();
      anim5.start();

      return () => {
        anim1.stop();
        anim2.stop();
        anim3.stop();
        anim4.stop();
        anim5.stop();
      };
    }
  }, [progress.phase, dot1Anim, dot2Anim, dot3Anim, dot4Anim, dot5Anim]);

  const createTranslateY = (anim: Animated.Value) => {
    return anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -20],
    });
  };

  // Check if we're in a loading/download phase
  const isDownloadPhase = progress.phase === 'loading_vision' || 
                          progress.phase === 'loading_embedding';

  const isActive = progress.phase !== 'idle' && progress.phase !== 'complete' && progress.phase !== 'error';

  return (
    <View style={styles.container}>
      {/* Percentage Display */}
      <View style={styles.percentageContainer}>
        <Text style={styles.percentageText}>
          {Math.round(progress.percentage)}%
        </Text>
      </View>

      {/* Bouncing Dots */}
      {isActive && (
        <View style={styles.dotsRow}>
          <Animated.View
            style={[
              styles.bounceDot,
              { transform: [{ translateY: createTranslateY(dot1Anim) }] },
            ]}
          />
          <Animated.View
            style={[
              styles.bounceDot,
              { transform: [{ translateY: createTranslateY(dot2Anim) }] },
            ]}
          />
          <Animated.View
            style={[
              styles.bounceDot,
              { transform: [{ translateY: createTranslateY(dot3Anim) }] },
            ]}
          />
          <Animated.View
            style={[
              styles.bounceDot,
              { transform: [{ translateY: createTranslateY(dot4Anim) }] },
            ]}
          />
          <Animated.View
            style={[
              styles.bounceDot,
              { transform: [{ translateY: createTranslateY(dot5Anim) }] },
            ]}
          />
        </View>
      )}

      {/* Status Text */}
      <View style={styles.statusContainer}>
        <Text style={styles.phaseText}>
          {progress.message}
        </Text>
        
        {/* Only show count for non-download phases with actual file progress */}
        {progress.total > 0 && !isDownloadPhase && (
          <Text style={styles.countText}>
            {progress.current} / {progress.total}
          </Text>
        )}
      </View>

      {/* Phase Dots */}
      <View style={styles.phaseDots}>
        {['loading_vision', 'captioning', 'loading_embedding', 'embedding', 'saving'].map(
          (phase) => (
            <View
              key={phase}
              style={[
                styles.phaseDot,
                progress.phase === phase && styles.phaseDotActive,
                isPhaseCompleted(progress.phase, phase) && styles.phaseDotCompleted,
              ]}
            />
          )
        )}
      </View>
    </View>
  );
};

// Helper to determine if a phase is completed
const phaseOrder = [
  'idle',
  'selecting',
  'loading_vision',
  'captioning',
  'unloading_vision',
  'loading_embedding',
  'embedding',
  'saving',
  'complete',
];

const isPhaseCompleted = (currentPhase: string, checkPhase: string): boolean => {
  const currentIndex = phaseOrder.indexOf(currentPhase);
  const checkIndex = phaseOrder.indexOf(checkPhase);
  return currentIndex > checkIndex;
};

// Compact variant for inline display
export const ProgressIndicatorCompact: React.FC<ProgressIndicatorProps> = ({
  progress,
}) => {
  return (
    <View style={styles.compactContainer}>
      <View style={styles.compactBarBackground}>
        <Animated.View
          style={[
            styles.compactBarFill,
            { width: `${progress.percentage}%` },
          ]}
        />
      </View>
      <Text style={styles.compactText}>
        {progress.message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  percentageContainer: {
    marginBottom: 32,
  },
  percentageText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: THEME.text,
    fontFamily: 'monospace',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 40,
    marginBottom: 32,
    gap: 12,
  },
  bounceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: THEME.text,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  phaseText: {
    fontSize: 16,
    color: THEME.text,
    fontFamily: 'monospace',
    marginBottom: 8,
    textAlign: 'center',
  },
  countText: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontFamily: 'monospace',
  },
  phaseDots: {
    flexDirection: 'row',
    gap: 8,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.border,
  },
  phaseDotActive: {
    backgroundColor: THEME.accent,
    transform: [{ scale: 1.3 }],
  },
  phaseDotCompleted: {
    backgroundColor: THEME.accent,
  },
  // Compact styles
  compactContainer: {
    width: '100%',
    padding: 16,
  },
  compactBarBackground: {
    height: 4,
    backgroundColor: THEME.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  compactBarFill: {
    height: '100%',
    backgroundColor: THEME.accent,
    borderRadius: 2,
  },
  compactText: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
});
