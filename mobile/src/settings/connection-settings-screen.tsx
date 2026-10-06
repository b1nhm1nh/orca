import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft, ChevronRight, Timer } from 'lucide-react-native'
import { PickerModal, type PickerOption } from '../components/PickerModal'
import {
  DEFAULT_RELAY_BACKGROUND_GRACE_MS,
  loadRelayBackgroundGraceMs,
  RELAY_BACKGROUND_GRACE_CHOICES_MS,
  saveRelayBackgroundGraceMs
} from '../transport/relay-background-grace-preference'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'

function graceLabel(ms: number): string {
  const label = ms < 60_000 ? `${ms / 1000} seconds` : `${ms / 60_000} minutes`
  return ms === DEFAULT_RELAY_BACKGROUND_GRACE_MS ? `${label} (default)` : label
}

const GRACE_OPTIONS: PickerOption[] = RELAY_BACKGROUND_GRACE_CHOICES_MS.map((ms) => ({
  value: String(ms),
  label: graceLabel(ms)
}))

export default function ConnectionSettingsScreen({
  onBack
}: {
  onBack?: () => void
}): React.JSX.Element {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [graceMs, setGraceMs] = useState(DEFAULT_RELAY_BACKGROUND_GRACE_MS)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void loadRelayBackgroundGraceMs().then((ms) => active && setGraceMs(ms))
    return () => {
      active = false
    }
  }, [])

  const selectGrace = useCallback((value: string) => {
    const ms = Number(value)
    setError(null)
    setGraceMs(ms)
    void saveRelayBackgroundGraceMs(ms).catch(() =>
      setError('Could not save connection preferences. Try again.')
    )
  }, [])

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backButton}
          onPress={onBack ?? (() => router.back())}
        >
          <ChevronLeft size={22} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.heading}>Connection</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.groupHeading}>BACKGROUND</Text>
        <Text style={styles.groupDescription}>
          How long a relay connection stays open after you leave the app. Longer keeps switching
          back instant but uses more battery. Your phone may still pause Orca sooner, and direct
          (same network) connections are closed by the phone, not by this setting.
        </Text>
        {error && (
          <Text accessibilityRole="alert" style={styles.groupDescription}>
            {error}
          </Text>
        )}
        <View style={[styles.section, styles.sectionTopGap]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Keep connection in background"
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => setPickerOpen(true)}
          >
            <Timer size={16} color={colors.textSecondary} />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Keep connection in background</Text>
              <Text style={styles.rowSublabel}>{graceLabel(graceMs)}</Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>

      <PickerModal
        visible={pickerOpen}
        title="Keep connection in background"
        options={GRACE_OPTIONS}
        selected={String(graceMs)}
        onSelect={selectGrace}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
    paddingHorizontal: spacing.lg,
    paddingTop: 0
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary
  },
  scrollContent: {
    paddingBottom: spacing.xl
  },
  groupHeading: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs
  },
  groupDescription: {
    fontSize: typography.bodySize - 1,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: spacing.xs
  },
  section: {
    backgroundColor: colors.bgPanel,
    borderRadius: radii.card,
    overflow: 'hidden'
  },
  sectionTopGap: {
    marginTop: spacing.sm
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md + 2
  },
  rowPressed: {
    backgroundColor: colors.bgRaised
  },
  rowContent: {
    flex: 1
  },
  rowLabel: {
    fontSize: typography.bodySize,
    fontWeight: '500',
    color: colors.textPrimary
  },
  rowSublabel: {
    fontSize: typography.bodySize - 2,
    color: colors.textSecondary,
    marginTop: 2
  }
})
