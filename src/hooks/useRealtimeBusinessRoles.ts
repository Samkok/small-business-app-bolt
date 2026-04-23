import { useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { dataCleanupRegistry } from '../utils/dataCleanupRegistry';
import { BusinessAccessHistory } from '../utils/businessAccessHistory';
import { selectBestAvailableBusiness } from './useBusinessManager';
import { isInvalidTokenError } from './useSessionManager';
import type { Business } from '../context/authTypes';

interface UseRealtimeBusinessRolesOptions {
  userId: string | undefined;
  session: Session | null;
  userBusinessesRef: React.MutableRefObject<Business[]>;
  currentBusinessRef: React.MutableRefObject<Business | null>;
  businessAccessHistoryRef: React.MutableRefObject<BusinessAccessHistory>;
  segments: string[];
  setUserBusinesses: React.Dispatch<React.SetStateAction<Business[]>>;
  setUserBusinessRoles: React.Dispatch<React.SetStateAction<Map<string, 'admin' | 'staff'>>>;
  switchBusiness: (id: string) => Promise<void>;
  setCurrentBusiness: (b: Business | null) => void;
  shouldAutoRedirectOnAssignment: (segments: string[], hasCurrentBusiness: boolean) => boolean;
  onInvalidToken: () => Promise<void>;
  refreshSessionIfNeeded: () => Promise<boolean>;
}

export function useRealtimeBusinessRoles({
  userId,
  session,
  userBusinessesRef,
  currentBusinessRef,
  businessAccessHistoryRef,
  segments,
  setUserBusinesses,
  setUserBusinessRoles,
  switchBusiness,
  setCurrentBusiness,
  shouldAutoRedirectOnAssignment,
  onInvalidToken,
  refreshSessionIfNeeded,
}: UseRealtimeBusinessRolesOptions) {
  const realtimeChannelRef = useRef<any>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeStatusRef = useRef<'disconnected' | 'connecting' | 'connected' | 'error'>(
    'disconnected',
  );
  const [realtimeStatus, setRealtimeStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const autoRedirectRef = useRef(false);
  const appStateRef = useRef('active');

  useEffect(() => {
    realtimeStatusRef.current = realtimeStatus;
  }, [realtimeStatus]);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message, [{ text: 'OK' }]);
    }
  };

  const navigateTo = async (path: string) => {
    try {
      const { router } = await import('expo-router');
      router.replace(path as any);
    } catch (e) {
      console.error('Navigation error:', e);
    }
  };

  const startPollingFallback = (userRef: React.MutableRefObject<any>) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (!userRef.current?.id) return;

    let lastBusinessIds = new Set(userBusinessesRef.current.map(b => b.id));
    let consecutiveFailures = 0;
    const MAX_FAILURES = 5;

    pollingIntervalRef.current = setInterval(async () => {
      try {
        if (!userRef.current?.id) {
          clearInterval(pollingIntervalRef.current!);
          pollingIntervalRef.current = null;
          return;
        }

        if (realtimeStatusRef.current === 'connected') {
          clearInterval(pollingIntervalRef.current!);
          pollingIntervalRef.current = null;
          return;
        }

        const { data: roles, error } = await supabase
          .from('user_business_roles')
          .select('business_id, role')
          .eq('user_id', userRef.current.id);

        if (error) {
          consecutiveFailures++;

          if (isInvalidTokenError(error)) {
            clearInterval(pollingIntervalRef.current!);
            pollingIntervalRef.current = null;
            await onInvalidToken();
            return;
          }

          const isAuthError =
            error.message?.includes('JWT') ||
            error.message?.includes('expired') ||
            error.code === 'PGRST301';

          if (isAuthError) {
            const ok = await refreshSessionIfNeeded();
            if (ok) {
              consecutiveFailures = 0;
            } else {
              clearInterval(pollingIntervalRef.current!);
              pollingIntervalRef.current = null;
            }
            return;
          }

          if (consecutiveFailures >= MAX_FAILURES) {
            clearInterval(pollingIntervalRef.current!);
            pollingIntervalRef.current = null;
          }
          return;
        }

        consecutiveFailures = 0;
        const currentIds = new Set((roles || []).map((r: any) => r.business_id));

        // Detect new businesses
        for (const newId of currentIds) {
          if (!lastBusinessIds.has(newId)) {
            const { data: newBiz, error: fetchErr } = await supabase
              .from('businesses')
              .select('*')
              .eq('id', newId)
              .single();

            if (!fetchErr && newBiz) {
              setUserBusinesses(prev =>
                prev.some(b => b.id === newBiz.id) ? prev : [...prev, newBiz],
              );
              if (!userBusinessesRef.current.some(b => b.id === newBiz.id)) {
                userBusinessesRef.current = [...userBusinessesRef.current, newBiz];
              }
              const role = roles!.find((r: any) => r.business_id === newId);
              if (role) {
                setUserBusinessRoles(prev => {
                  const m = new Map(prev);
                  m.set(newId, role.role as 'admin' | 'staff');
                  return m;
                });
              }
              await switchBusiness(newId);
              setTimeout(async () => {
                await navigateTo('/(app)/(tabs)');
                setTimeout(() => {
                  showAlert('Welcome!', `You've been added to ${newBiz.business_name}`);
                }, 500);
              }, 200);
            }
          }
        }

        // Detect removed businesses
        for (const oldId of lastBusinessIds) {
          if (!currentIds.has(oldId)) {
            if (currentBusinessRef.current?.id === oldId) {
              const removedName =
                userBusinessesRef.current.find(b => b.id === oldId)?.business_name ||
                'this business';
              const remaining = userBusinessesRef.current.filter(b => b.id !== oldId);

              setUserBusinesses(remaining);
              setUserBusinessRoles(prev => {
                const m = new Map(prev);
                m.delete(oldId);
                return m;
              });
              dataCleanupRegistry.cleanupForRemovedBusiness(oldId);

              if (remaining.length > 0) {
                const next = selectBestAvailableBusiness(
                  oldId,
                  remaining,
                  businessAccessHistoryRef.current,
                );
                if (next) {
                  await switchBusiness(next.id);
                  setTimeout(async () => {
                    await navigateTo('/(app)/(tabs)');
                    setTimeout(() => {
                      showAlert(
                        'Business Access Removed',
                        `You were removed from "${removedName}". Switched to "${next.business_name}".`,
                      );
                    }, 500);
                  }, 200);
                }
              } else {
                setCurrentBusiness(null);
                setTimeout(async () => {
                  await navigateTo('/(app)/business-onboarding');
                  setTimeout(() => {
                    showAlert(
                      'Business Access Removed',
                      `You were removed from "${removedName}" and have no other businesses.`,
                    );
                  }, 500);
                }, 200);
              }
            } else {
              setUserBusinesses(prev => prev.filter(b => b.id !== oldId));
              setUserBusinessRoles(prev => {
                const m = new Map(prev);
                m.delete(oldId);
                return m;
              });
            }
          }
        }

        lastBusinessIds = currentIds;
      } catch (e) {
        console.error('Polling fallback error:', e);
      }
    }, 10000);
  };

  useEffect(() => {
    if (!userId || !session) {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      return;
    }

    // External userRef passed by the provider so polling can always access the latest user
    const userRef = { current: { id: userId } };

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (subscriptionTimeoutRef.current) {
      clearTimeout(subscriptionTimeoutRef.current);
      subscriptionTimeoutRef.current = null;
    }

    setRealtimeStatus('connecting');

    const channelName = `user_business_roles:${userId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_business_roles',
          filter: `user_id=eq.${userId}`,
        },
        async payload => {
          if (payload.eventType === 'INSERT') {
            const newBusinessId = (payload.new as any).business_id;
            const { data: newBiz, error } = await supabase
              .from('businesses')
              .select('*')
              .eq('id', newBusinessId)
              .single();

            if (!error && newBiz) {
              setUserBusinesses(prev =>
                prev.some(b => b.id === newBiz.id) ? prev : [...prev, newBiz],
              );
              setUserBusinessRoles(prev => {
                const m = new Map(prev);
                m.set(newBusinessId, (payload.new as any).role as 'admin' | 'staff');
                return m;
              });
              if (!userBusinessesRef.current.some(b => b.id === newBiz.id)) {
                userBusinessesRef.current = [...userBusinessesRef.current, newBiz];
              }

              const shouldRedirect = shouldAutoRedirectOnAssignment(
                segments,
                !!currentBusinessRef.current,
              );
              await switchBusiness(newBusinessId);

              if (shouldRedirect && !autoRedirectRef.current) {
                autoRedirectRef.current = true;
                Alert.alert('Welcome!', `You've been added to ${newBiz.business_name}`, [
                  { text: 'OK' },
                ]);
                await navigateTo('/(app)/(tabs)');
                setTimeout(() => {
                  autoRedirectRef.current = false;
                }, 2000);
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const businessId = (payload.new as any).business_id;
            const newRole = (payload.new as any).role as 'admin' | 'staff';
            setUserBusinessRoles(prev => {
              const m = new Map(prev);
              m.set(businessId, newRole);
              return m;
            });
          } else if (payload.eventType === 'DELETE') {
            const removedId = (payload.old as any).business_id;
            const removedName =
              userBusinessesRef.current.find(b => b.id === removedId)?.business_name ||
              'this business';
            const wasCurrent = currentBusinessRef.current?.id === removedId;

            let updatedList: Business[] = [];
            setUserBusinesses(prev => {
              const filtered = prev.filter(b => b.id !== removedId);
              updatedList = filtered;
              return filtered;
            });
            setUserBusinessRoles(prev => {
              const m = new Map(prev);
              m.delete(removedId);
              return m;
            });
            dataCleanupRegistry.cleanupForRemovedBusiness(removedId);

            if (wasCurrent) {
              setTimeout(async () => {
                const remaining = updatedList;
                if (remaining.length > 0) {
                  const next = selectBestAvailableBusiness(
                    removedId,
                    remaining,
                    businessAccessHistoryRef.current,
                  );
                  if (next) {
                    await switchBusiness(next.id);
                    setTimeout(async () => {
                      await navigateTo('/(app)/(tabs)');
                      setTimeout(() => {
                        showAlert(
                          'Business Access Removed',
                          `You were removed from "${removedName}". Switched to "${next.business_name}".`,
                        );
                      }, 500);
                    }, 200);
                  } else {
                    setCurrentBusiness(null);
                  }
                } else {
                  setCurrentBusiness(null);
                  setTimeout(async () => {
                    await navigateTo('/(app)/business-onboarding');
                    setTimeout(() => {
                      showAlert(
                        'Business Access Removed',
                        `You were removed from "${removedName}" and have no other businesses. You can create a new business to continue.`,
                      );
                    }, 500);
                  }, 200);
                }
              }, 100);
            }
          }
        },
      )
      .on('system', {}, (payload: any) => {
        if (payload.status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
          if (subscriptionTimeoutRef.current) {
            clearTimeout(subscriptionTimeoutRef.current);
            subscriptionTimeoutRef.current = null;
          }
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        } else if (payload.status === 'CHANNEL_ERROR' || payload.status === 'TIMED_OUT') {
          setRealtimeStatus('error');
        } else if (payload.status === 'CLOSED') {
          setRealtimeStatus('disconnected');
        }
      })
      .subscribe((status, err) => {
        if (err) {
          console.error('Realtime subscription error:', err);
          setRealtimeStatus('error');
        }
      });

    realtimeChannelRef.current = channel;

    subscriptionTimeoutRef.current = setTimeout(() => {
      if (realtimeStatusRef.current !== 'connected') {
        startPollingFallback(userRef as any);
      }
    }, 10000);

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
        subscriptionTimeoutRef.current = null;
      }
      setRealtimeStatus('disconnected');
    };
  }, [userId, session]);
}
