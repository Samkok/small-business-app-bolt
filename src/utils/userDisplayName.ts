/**
 * Utility functions for displaying user names with GDPR/CCPA compliance
 *
 * When users delete their accounts, their user_id becomes NULL but their
 * display name is preserved in denormalized columns for audit trail purposes.
 * These helpers ensure we show the correct name in all scenarios.
 */

/**
 * Gets the display name for a user, handling deleted users gracefully
 *
 * @param displayName - The preserved display name from the record (e.g., created_by_name)
 * @param userId - The user ID (may be NULL if user deleted)
 * @param userProfile - Optional: The user profile object if you already fetched it
 * @returns Display name string or fallback
 *
 * @example
 * // Sale record: { created_by: null, created_by_name: "John Doe" }
 * getUserDisplayName(sale.created_by_name, sale.created_by) // Returns: "John Doe"
 *
 * @example
 * // Sale record: { created_by: "abc-123", created_by_name: "Jane Smith" }
 * getUserDisplayName(sale.created_by_name, sale.created_by) // Returns: "Jane Smith"
 *
 * @example
 * // Sale record: { created_by: "abc-123", created_by_name: null }
 * getUserDisplayName(sale.created_by_name, sale.created_by, userProfile) // Returns user's current name from profile
 */
export function getUserDisplayName(
  displayName: string | null | undefined,
  userId: string | null | undefined,
  userProfile?: { full_name?: string | null; email?: string | null }
): string {
  // Priority 1: Use preserved display name (works for both active and deleted users)
  if (displayName) {
    return displayName;
  }

  // Priority 2: If we have a user profile object, use it
  if (userProfile) {
    return userProfile.full_name || userProfile.email || 'Unknown User';
  }

  // Priority 3: If user_id is NULL, user was deleted
  if (!userId) {
    return 'Deleted User';
  }

  // Priority 4: We have a user_id but no name info
  // Caller should fetch the user profile if they want the current name
  return 'Unknown User';
}

/**
 * Format display name with additional context
 *
 * @param displayName - The preserved display name
 * @param userId - The user ID (may be NULL if deleted)
 * @param showDeletedIndicator - Whether to show "(deleted)" suffix
 * @returns Formatted display name
 *
 * @example
 * formatUserDisplayName("John Doe", null, true) // Returns: "John Doe (deleted)"
 * formatUserDisplayName("Jane Smith", "abc-123", true) // Returns: "Jane Smith"
 */
export function formatUserDisplayName(
  displayName: string | null | undefined,
  userId: string | null | undefined,
  showDeletedIndicator: boolean = false
): string {
  const name = getUserDisplayName(displayName, userId);

  // Add "(deleted)" suffix if user was deleted and indicator requested
  if (showDeletedIndicator && !userId && displayName) {
    return `${name} (deleted)`;
  }

  return name;
}

/**
 * Check if a user has been deleted
 *
 * @param displayName - The preserved display name
 * @param userId - The user ID
 * @returns true if user was deleted, false otherwise
 */
export function isUserDeleted(
  displayName: string | null | undefined,
  userId: string | null | undefined
): boolean {
  // User is deleted if we have a display name but no user_id
  // (display name was preserved, user_id was SET NULL)
  return !!displayName && !userId;
}

/**
 * Get short display name (first name + last initial)
 *
 * @param displayName - Full display name
 * @returns Short format (e.g., "John D.")
 *
 * @example
 * getShortDisplayName("John Doe") // Returns: "John D."
 * getShortDisplayName("Jane") // Returns: "Jane"
 */
export function getShortDisplayName(displayName: string | null | undefined): string {
  if (!displayName) {
    return 'Unknown';
  }

  const parts = displayName.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0];
  }

  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0];

  return `${firstName} ${lastInitial}.`;
}
