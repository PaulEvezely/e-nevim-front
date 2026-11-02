import { Link, useNavigate } from "react-router";
import { useNotificationContext } from "../../features/notifications/NotificationProvider";
import { resolveNotificationRoute } from "../../features/notifications/notificationRouting";
import { formatRelativeTime } from "../../features/notifications/format";
import { getNotificationTypeUi } from "../../features/notifications/notificationUi";
import type { NotificationItem } from "../../features/notifications/types";

function NotificationRow({
  item,
  onSelect,
}: {
  item: NotificationItem;
  onSelect: (item: NotificationItem) => void;
}) {
  const ui = getNotificationTypeUi(item.tipo);
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item)}
        className={`w-full text-left px-4 py-3 flex gap-3 transition-colors focus:outline-none focus-visible:bg-[#E6F1FB] ${
          item.lida ? "bg-white hover:bg-stone-50" : "bg-[#E6F1FB]/50 hover:bg-[#E6F1FB]"
        }`}
      >
        <span
          aria-hidden="true"
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
            item.lida ? "bg-transparent" : "bg-[#378ADD]"
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0 text-sm font-semibold text-gray-800 leading-snug">
              <span
                className={`mr-1.5 inline-block rounded px-1.5 py-px align-middle text-[10px] font-bold uppercase tracking-wide ${ui.chipClass}`}
              >
                {ui.label}
              </span>
              {item.titulo}
            </span>
            <span className="shrink-0 text-[11px] text-gray-500">
              {formatRelativeTime(item.criadoEm)}
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-gray-600 leading-snug line-clamp-2 break-words [overflow-wrap:anywhere]">
            {item.mensagem}
          </span>
        </span>
      </button>
    </li>
  );
}

export function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const {
    notifications,
    unreadCount,
    total,
    loading,
    loadingMore,
    error,
    role,
    markAsRead,
    markAllAsRead,
    refresh,
    loadMore,
  } = useNotificationContext();
  const navigate = useNavigate();

  const remaining = Math.max(0, total - notifications.length);
  const hasMore = remaining > 0;
  const allHref =
    role === "manager" || role === "admin"
      ? "/manager/notificacoes"
      : role === "user"
        ? "/user/notificacoes"
        : null;

  const handleSelect = (item: NotificationItem) => {
    if (!item.lida) {
      void markAsRead(item.id);
    }
    const route = resolveNotificationRoute(
      item.entidade,
      item.entidadeId,
      role,
    );
    onClose();
    if (route) navigate(route);
  };

  return (
    <div
      role="dialog"
      aria-label="Notificações"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className="fixed left-4 right-4 z-50 mt-2 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-[min(92vw,24rem)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">Notificações</p>
          <p className="text-[11px] text-gray-500">
            {unreadCount > 0
              ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}`
              : "Tudo em dia"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void markAllAsRead()}
          disabled={unreadCount === 0}
          className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-[#0C447C] transition-colors hover:bg-[#E6F1FB] disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
        >
          Marcar todas como lidas
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="border-b border-red-200 bg-[#FCEBEB] px-4 py-2 text-xs text-[#791F1F]"
        >
          {error}
        </div>
      ) : null}

      <div className="max-h-[min(60vh,22rem)] overflow-y-auto">
        {loading && notifications.length === 0 ? (
          <div className="space-y-3 p-4" aria-label="Carregando notificações">
            {[0, 1, 2].map((index) => (
              <div key={index} className="animate-pulse space-y-2">
                <div className="h-3 w-2/3 rounded bg-stone-200" />
                <div className="h-3 w-full rounded bg-stone-100" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-gray-700">
              Nenhuma notificação por aqui
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Avisaremos quando algo novo acontecer.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {notifications.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onSelect={handleSelect}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-stone-200 px-4 py-2">
        {hasMore ? (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-[#0C447C] transition-colors hover:bg-[#E6F1FB] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#378ADD]"
          >
            {loadingMore
              ? "Carregando…"
              : `Carregar mais (${remaining} restante${remaining > 1 ? "s" : ""})`}
          </button>
        ) : (
          <span className="px-2 py-1 text-[11px] text-gray-400">
            {total > 0
              ? `${total} no total`
              : ""}
          </span>
        )}
        <div className="flex shrink-0 items-center gap-1">
          {allHref ? (
            <Link
              to={allHref}
              onClick={onClose}
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-[#378ADD] transition-colors hover:text-[#0C447C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#378ADD]"
            >
              Ver todos →
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-[#378ADD] transition-colors hover:text-[#0C447C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#378ADD]"
          >
            Atualizar
          </button>
        </div>
      </div>
    </div>
  );
}
