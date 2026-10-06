import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import { TEXT_INPUT_FONT_SIZE } from '../platform/text-input-font-size'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { MIN_BACKUP_PASSWORD_LENGTH } from './device-backup-encryption'

export type BackupPasswordMode = 'export' | 'import'

type Props = {
  mode: BackupPasswordMode | null
  onSubmit: (password: string) => void
  onCancel: () => void
}

/** Password prompt for backups; export asks twice because a typo would lock the file forever. */
export function BackupPasswordDrawer({ mode, onSubmit, onCancel }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [shownMode, setShownMode] = useState(mode)

  // Why: clear the fields before the opening commit so a previous password never paints.
  if (mode !== shownMode) {
    setShownMode(mode)
    if (mode) {
      setPassword('')
      setConfirm('')
    }
  }

  const exporting = mode === 'export'
  const tooShort = exporting && password.length < MIN_BACKUP_PASSWORD_LENGTH
  const mismatch = exporting && confirm.length > 0 && confirm !== password
  const canSubmit =
    password.length > 0 && !tooShort && (!exporting || (confirm === password && !mismatch))

  function submit() {
    if (canSubmit) {
      onSubmit(password)
    }
  }

  return (
    <BottomDrawer visible={mode !== null} onClose={onCancel}>
      <View style={styles.header}>
        <Text style={styles.title}>{exporting ? 'Encrypt backup' : 'Unlock backup'}</Text>
        <Text style={styles.message}>
          {exporting
            ? `Choose a password of at least ${MIN_BACKUP_PASSWORD_LENGTH} characters. You need it to import this file; it cannot be recovered.`
            : 'Enter the password used when this backup was exported.'}
        </Text>
      </View>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        textContentType={exporting ? 'newPassword' : 'password'}
        returnKeyType={exporting ? 'next' : 'done'}
        onSubmitEditing={exporting ? undefined : submit}
        selectionColor={colors.accentBlue}
      />
      {exporting && (
        <TextInput
          style={[styles.input, styles.inputGap]}
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Confirm password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
          selectionColor={colors.accentBlue}
        />
      )}
      {mismatch && <Text style={styles.hint}>Passwords do not match</Text>}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]}
          onPress={onCancel}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.buttonPressed,
            !canSubmit && styles.submitButtonDisabled
          ]}
          disabled={!canSubmit}
          onPress={submit}
        >
          <Text style={styles.submitText}>{exporting ? 'Export' : 'Import'}</Text>
        </Pressable>
      </View>
    </BottomDrawer>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary
  },
  message: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2
  },
  input: {
    backgroundColor: colors.bgRaised,
    color: colors.textPrimary,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.sm,
    fontSize: TEXT_INPUT_FONT_SIZE,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  inputGap: {
    marginTop: spacing.sm
  },
  hint: {
    fontSize: 13,
    color: colors.statusRed,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md
  },
  cancelButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.button
  },
  submitButton: {
    backgroundColor: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.button
  },
  buttonPressed: {
    opacity: 0.7
  },
  submitButtonDisabled: {
    opacity: 0.4
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: typography.bodySize,
    fontWeight: '500'
  },
  submitText: {
    color: colors.bgBase,
    fontSize: typography.bodySize,
    fontWeight: '600'
  }
})
