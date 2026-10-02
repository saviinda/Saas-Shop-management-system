'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { AppNotification } from '@saas/types';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
  Check,
  ExternalLink,
  Wifi,
  WifiOff,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const NotificationDropdown: React.FC = () => {
  const router = useRouter();
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch initial notification list from backend API
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get<{ notifications: AppNotification[]; unreadCount: number }>('/notifications');
      if (res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.warn('[Notifications] Failed to fetch notifications:', err);
    }
  }, []);

  // Connect to real-time Server-Sent Events (SSE) notification stream
  useEffect(() => {
    fetchNotifications();

    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('saas_token') : null);
    if (!authToken) return;

    let retryTimeout: NodeJS.Timeout;

    const connectSSE = () => {
      try {
        const streamUrl = `${API_BASE_URL}/notifications/stream?token=${encodeURIComponent(authToken)}`;
        const es = new EventSource(streamUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          setIsConnected(true);
        };

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected') {
              setIsConnected(true);
            } else if (data.type === 'new_notification' && data.notification) {
              const newNotif = data.notification as AppNotification;
              setNotifications(prev => {
                // Prevent duplicate addition
                if (prev.some(n => n.id === newNotif.id)) return prev;
                return [newNotif, ...prev];
              });
              setUnreadCount(prev => prev + 1);
            } else if (data.type === 'notification_read') {
              setNotifications(prev =>
                prev.map(n => (n.id === data.id ? { ...n, isRead: true } : n))
              );
              setUnreadCount(prev => Math.max(0, prev - 1));
            } else if (data.type === 'all_notifications_read') {
              setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
              setUnreadCount(0);
            }
          } catch (err) {
            console.error('[Notifications] SSE payload parse error:', err);
          }
        };

        es.onerror = () => {
          setIsConnected(false);
          es.close();
          // Auto-reconnect after 6 seconds
          retryTimeout = setTimeout(connectSSE, 6000);
        };
      } catch (err) {
        console.warn('[Notifications] SSE connection error:', err);
        retryTimeout = setTimeout(connectSSE, 10000);
      }
    };

    connectSSE();

    // Fallback sync polling every 45s in case network interrupted SSE
    const syncInterval = setInterval(fetchNotifications, 45000);

    return () => {
      clearTimeout(retryTimeout);
      clearInterval(syncInterval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [fetchNotifications, token]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  /**
   * Intelligently resolves notification links based on current user role
   */
  const resolveNotificationLink = (rawLink?: string): string => {
    const isSuperAdmin = user?.role === 'super_admin';
    const prefix = isSuperAdmin ? '/super-admin' : '/shop-owner';

    if (!rawLink) {
      return isSuperAdmin ? '/super-admin/dashboard' : '/shop-owner/dashboard';
    }

    if (rawLink.startsWith('/super-admin') || rawLink.startsWith('/shop-owner') || rawLink.startsWith('/login')) {
      return rawLink;
    }

    if (rawLink.startsWith('/communication')) return `${prefix}/communication`;
    if (rawLink.startsWith('/payments')) return isSuperAdmin ? '/super-admin/payments' : '/shop-owner/subscription';
    if (rawLink.startsWith('/subscription')) return '/shop-owner/subscription';
    if (rawLink.startsWith('/change-requests')) return isSuperAdmin ? '/super-admin/change-requests' : '/shop-owner/dashboard';
    if (rawLink.startsWith('/shops')) return isSuperAdmin ? '/super-admin/shops' : '/shop-owner/dashboard';
    if (rawLink.startsWith('/users')) return isSuperAdmin ? '/super-admin/users' : '/shop-owner/staff';
    if (rawLink.startsWith('/tasks')) return '/shop-owner/tasks';
    if (rawLink.startsWith('/orders')) return '/shop-owner/orders';
    if (rawLink.startsWith('/inventory')) return '/shop-owner/inventory';
    if (rawLink.startsWith('/procurement')) return '/shop-owner/procurement';
    if (rawLink.startsWith('/batches')) return '/shop-owner/batches';
    if (rawLink.startsWith('/categories') || rawLink.startsWith('/products/categories')) return '/shop-owner/products/categories';
    if (rawLink.startsWith('/products')) return '/shop-owner/products';

    return `${prefix}${rawLink.startsWith('/') ? rawLink : '/' + rawLink}`;
  };

  const handleMarkAsRead = async (id: string, rawLink?: string) => {
    try {
      await api.patch(`/notifications/${id}/read`, {});
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      const targetUrl = resolveNotificationLink(rawLink);
      setIsOpen(false);
      router.push(targetUrl);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsLoading(true);
    try {
      await api.patch('/notifications/all/read', {});
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getIconForType = (type?: string) => {
    switch (type) {
      case 'alert':
        return <ShieldAlert className="h-4 w-4 text-rose-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      default:
        return <Info className="h-4 w-4 text-indigo-600" />;
    }
  };

  const getBgForType = (type?: string) => {
    switch (type) {
      case 'alert':
        return 'bg-rose-50 border-rose-200/80';
      case 'warning':
        return 'bg-amber-50 border-amber-200/80';
      case 'success':
        return 'bg-emerald-50 border-emerald-200/80';
      default:
        return 'bg-indigo-50 border-indigo-200/80';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        title="Real-Time System Notifications"
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all duration-200 cursor-pointer"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-50">
            {unreadCount > 9 ? '9+' : unreadCount}
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-rose-500 animate-ping" />
          </span>
        )}
      </button>

      {/* Notification Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200/90 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Popover Header */}
          <div className="p-4 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 ? (
                <Badge variant="info" className="text-[10px] px-2 py-0">
                  {unreadCount} new
                </Badge>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <span
                title={isConnected ? 'Real-time connected' : 'Reconnecting...'}
                className="flex items-center gap-1 text-[10px] font-medium text-slate-400"
              >
                {isConnected ? (
                  <Wifi className="h-3 w-3 text-emerald-500" />
                ) : (
                  <WifiOff className="h-3 w-3 text-amber-500" />
                )}
                <span className="hidden sm:inline">{isConnected ? 'Live' : 'Connecting'}</span>
              </span>

              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={isLoading}
                  className="text-[11px] h-7 px-2 font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                >
                  <Check className="h-3.5 w-3.5 mr-1" /> Mark read
                </Button>
              )}
            </div>
          </div>

          {/* Notifications Scroll List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="h-10 w-10 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700">All caught up!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No active system alerts. Live events will appear here in real time.
                </p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => handleMarkAsRead(notif.id, notif.link)}
                  className={`p-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer text-xs ${
                    !notif.isRead ? 'bg-indigo-50/30' : ''
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 border ${getBgForType(
                      notif.type
                    )}`}
                  >
                    {getIconForType(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className={`text-xs truncate ${!notif.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {notif.title}
                      </p>
                      {!notif.isRead && (
                        <span className="h-2 w-2 rounded-full bg-indigo-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                    <div className="flex items-center justify-between mt-1.5 pt-1 text-[10px] text-slate-400">
                      <span>{formatDate(notif.createdAt)}</span>
                      <span className="text-indigo-600 font-semibold flex items-center gap-0.5 hover:underline">
                        View details <ExternalLink className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between px-4">
            <span className="text-[10px] text-slate-400 font-medium">
              Live Real-Time SSE Stream
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              Role: <span className="capitalize text-slate-600 font-semibold">{user?.role?.replace('_', ' ')}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
