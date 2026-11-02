import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import type { Role } from "../auth/types/login";
import {
  fetchNotificationsClient,
  markAllNotificationsReadClient,
  markNotificationReadClient,
} from "./notificationsApi.client";
import {
  useAppointmentReminders,
  type AppointmentReminderToast,
} from "./useAppointmentReminders";
import type { NotificationItem } from "./types";

/** Polling near-real-time: contadores do back são indexados (@@index). */
const REFRESH_INTERVAL_MS = 60 * 1000;
const LIST_LIMIT = 20;

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  /** Total no back-end (pode ser maior que notifications.length). */
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  role: Role | null;
  authenticated: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

export function useNotificationContext(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotificationContext must be used within NotificationProvider",
    );
  }
  return context;
}

function ReminderToasts({
  reminders,
  onDismiss,
}: {
  reminders: AppointmentReminderToast[];
  onDismiss: (id: string) => void;
}) {
  const navigate = useNavigate();
  if (reminders.length === 0) return null;

  return (
    <div
      // Canto inferior esquerdo: o botão de pânico ocupa o canto direito
      // (fixed bottom-4 right-4 em EmergencyExitButton).
      className="fixed bottom-4 left-4 z-50 flex w-[min(92vw,22rem)] flex-col gap-2"
      aria-live="polite"
      aria-label="Lembretes de consulta"
    >
      {reminders.map((reminder) => (
        <div
          key={reminder.id}
          role="status"
          className="flex items-start gap-3 rounded-xl border border-[#dbeafe] bg-[#E6F1FB] px-4 py-3 text-[#0C447C] shadow-lg"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="mt-0.5 h-5 w-5 shrink-0"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {reminder.route ? (
            <button
              type="button"
              onClick={() => {
                onDismiss(reminder.id);
                navigate(reminder.route as string);
              }}
              className="min-w-0 flex-1 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#378ADD]"
              aria-label={`${reminder.title}. ${reminder.message} Ir para a agenda.`}
            >
              <p className="text-sm font-semibold leading-snug">
                {reminder.title}
              </p>
              <p className="mt-0.5 text-sm leading-snug">{reminder.message}</p>
              <p className="mt-1 text-[11px] font-semibold underline underline-offset-2">
                Ver na agenda
              </p>
            </button>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug">
                {reminder.title}
              </p>
              <p className="mt-0.5 text-sm leading-snug">{reminder.message}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => onDismiss(reminder.id)}
            aria-label="Dispensar lembrete"
            className="shrink-0 rounded-md px-1 text-lg leading-none text-[#0C447C]/70 transition-colors hover:text-[#0C447C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#378ADD]"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function NotificationProvider({
  authenticated,
  role,
  children,
}: {
  authenticated: boolean;
  role: Role | null;
  children: ReactNode;
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!authenticated) {
      setNotifications([]);
      setUnreadCount(0);
      setTotal(0);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchNotificationsClient({ limit: LIST_LIMIT });
      if (!mountedRef.current) return;
      setNotifications(data.notificacoes);
      setUnreadCount(data.naoLidas);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar as notificações.",
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [authenticated]);

  /** Carrega a próxima página e anexa à lista (com dedupe por id). */
  const loadMore = useCallback(async () => {
    if (!authenticated || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchNotificationsClient({
        limit: LIST_LIMIT,
        offset: notifications.length,
      });
      if (!mountedRef.current) return;
      setNotifications((current) => {
        const seen = new Set(current.map((item) => item.id));
        const fresh = data.notificacoes.filter((item) => !seen.has(item.id));
        return [...current, ...fresh];
      });
      setUnreadCount(data.naoLidas);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar mais notificações.",
      );
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [authenticated, loadingMore, notifications.length]);

  const markAsRead = useCallback(
    async (id: string) => {
      const target = notifications.find((item) => item.id === id);
      if (!target || target.lida) return;

      setNotifications((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, lida: true, lidaEm: new Date().toISOString() }
            : item,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));

      try {
        await markNotificationReadClient(id);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível marcar a notificação como lida.",
        );
        await refresh();
      }
    },
    [notifications, refresh],
  );

  const markAllAsRead = useCallback(async () => {
    if (unreadCount === 0) return;

    const previous = notifications;
    setNotifications((current) =>
      current.map((item) =>
        item.lida
          ? item
          : { ...item, lida: true, lidaEm: new Date().toISOString() },
      ),
    );
    setUnreadCount(0);

    try {
      await markAllNotificationsReadClient();
    } catch (err) {
      setNotifications(previous);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível marcar as notificações como lidas.",
      );
      await refresh();
    }
  }, [notifications, refresh, unreadCount]);

  useEffect(() => {
    if (!authenticated) {
      setNotifications([]);
      setUnreadCount(0);
      setTotal(0);
      setError(null);
      return;
    }
    void refresh();
  }, [authenticated, refresh]);

  useEffect(() => {
    if (!authenticated) return;

    const interval = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [authenticated, refresh]);

  const { reminders, dismiss } = useAppointmentReminders(authenticated, role);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      total,
      loading,
      loadingMore,
      error,
      role,
      authenticated,
      refresh,
      loadMore,
      markAsRead,
      markAllAsRead,
    }),
    [
      notifications,
      unreadCount,
      total,
      loading,
      loadingMore,
      error,
      role,
      authenticated,
      refresh,
      loadMore,
      markAsRead,
      markAllAsRead,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ReminderToasts reminders={reminders} onDismiss={dismiss} />
    </NotificationContext.Provider>
  );
}
