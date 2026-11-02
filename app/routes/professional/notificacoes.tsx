import { useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/notificacoes";
import { requireUser } from "../../../features/auth/require-user.server";
import { useNotificationContext } from "../../../features/notifications/NotificationProvider";
import { resolveNotificationRoute } from "../../../features/notifications/notificationRouting";
import { getNotificationTypeUi } from "../../../features/notifications/notificationUi";
import {
  formatDayKey,
  formatRelativeTime,
} from "../../../features/notifications/format";
import type { NotificationItem } from "../../../features/notifications/types";
import { SkeletonCard } from "../../../shared/components/LoadingOverlay";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request, ["professional"]);
  return null;
}

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
        className={`flex w-full gap-3 px-4 py-3 text-left transition-colors focus:outline-none focus-visible:bg-[#E6F1FB] ${
          item.lida
            ? "bg-white hover:bg-stone-50"
            : "bg-[#E6F1FB]/50 hover:bg-[#E6F1FB]"
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
            <span className="min-w-0 text-sm font-semibold leading-snug text-gray-800">
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
          <span className="mt-0.5 block text-xs leading-snug text-gray-600">
            {item.mensagem}
          </span>
        </span>
      </button>
    </li>
  );
}

export default function ProfessionalNotificacoes() {
  const {
    notifications,
    unreadCount,
    total,
    loading,
    loadingMore,
    role,
    markAsRead,
    markAllAsRead,
    refresh,
    loadMore,
  } = useNotificationContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const onlyUnread = searchParams.get("lida") === "false";

  const visible = onlyUnread
    ? notifications.filter((item) => !item.lida)
    : notifications;

  const todayKey = formatDayKey(new Date().toISOString());
  const today = visible.filter((item) => formatDayKey(item.criadoEm) === todayKey);
  const earlier = visible.filter(
    (item) => formatDayKey(item.criadoEm) !== todayKey,
  );

  const remaining = Math.max(0, total - notifications.length);
  const hasMore = remaining > 0;

  const handleSelect = (item: NotificationItem) => {
    if (!item.lida) {
      void markAsRead(item.id);
    }
    const route = resolveNotificationRoute(item.entidade, item.entidadeId, role);
    if (route) navigate(route);
  };

  function setFilter(next: "all" | "unread") {
    setSearchParams(next === "unread" ? { lida: "false" } : {});
  }

  return (
    <section className="mx-auto max-w-3xl p-4 lg:p-6" aria-label="Central de notificações">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 lg:text-2xl">
            Notificações
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Tudo que precisa da sua atenção, mais recentes primeiro.
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {total === 0
              ? "Nenhuma notificação."
              : `${total} no total · ${unreadCount} não lida${unreadCount === 1 ? "" : "s"}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void markAllAsRead()}
          disabled={unreadCount === 0}
          className="rounded-xl bg-[#378ADD] px-3 py-2 text-xs font-semibold text-white shadow transition-colors hover:bg-[#0C447C] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Marcar todas como lidas
        </button>
      </div>

      <div
        className="mt-4 flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filtrar notificações"
      >
        <button
          type="button"
          onClick={() => setFilter("all")}
          aria-current={!onlyUnread ? "true" : undefined}
          className={
            !onlyUnread
              ? "rounded-full bg-[#0C447C] px-3 py-1.5 text-xs font-semibold text-white shadow"
              : "rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-stone-50"
          }
        >
          Todas
        </button>
        <button
          type="button"
          onClick={() => setFilter("unread")}
          aria-current={onlyUnread ? "true" : undefined}
          className={
            onlyUnread
              ? "rounded-full bg-[#0C447C] px-3 py-1.5 text-xs font-semibold text-white shadow"
              : "rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-stone-50"
          }
        >
          Não lidas · {unreadCount}
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        {loading && notifications.length === 0 ? (
          <div className="space-y-3 p-4" aria-label="Carregando notificações">
            {[0, 1, 2, 3].map((index) => (
              <SkeletonCard key={index} lines={2} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-gray-700">
              {onlyUnread
                ? "Nenhuma notificação não lida"
                : "Nenhuma notificação por aqui"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Avisaremos quando algo novo acontecer.
            </p>
          </div>
        ) : (
          <>
            {today.length > 0 ? (
              <>
                <h2 className="border-b border-stone-200 bg-stone-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Hoje
                </h2>
                <ul className="divide-y divide-stone-100">
                  {today.map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      onSelect={handleSelect}
                    />
                  ))}
                </ul>
              </>
            ) : null}
            {earlier.length > 0 ? (
              <>
                <h2 className="border-b border-stone-200 bg-stone-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Anteriores
                </h2>
                <ul className="divide-y divide-stone-100">
                  {earlier.map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      onSelect={handleSelect}
                    />
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {hasMore ? (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-[#0C447C] shadow-sm transition-colors hover:bg-[#E6F1FB] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore
              ? "Carregando…"
              : `Carregar mais (${remaining} restante${remaining > 1 ? "s" : ""})`}
          </button>
        ) : (
          <span className="text-xs text-gray-400">
            {total > 0 ? "Todas as notificações carregadas." : ""}
          </span>
        )}
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl px-4 py-2 text-xs font-semibold text-[#378ADD] transition-colors hover:text-[#0C447C]"
        >
          Atualizar
        </button>
      </div>
    </section>
  );
}
