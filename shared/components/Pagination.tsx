import { Link, useLocation } from "react-router";
import { cn } from "../../libs/utils";

type PaginationProps = {
  page: number;
  totalPages: number;
  /** Query param that holds the page number. */
  pageParam?: string;
  className?: string;
};

type PageItem = number | "ellipsis-start" | "ellipsis-end";

function getPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const items: PageItem[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) items.push("ellipsis-start");
  for (let current = start; current <= end; current += 1) items.push(current);
  if (end < totalPages - 1) items.push("ellipsis-end");
  items.push(totalPages);
  return items;
}

export function Pagination({
  page,
  totalPages,
  pageParam = "page",
  className,
}: PaginationProps) {
  const location = useLocation();
  if (totalPages <= 1) return null;

  const buildHref = (targetPage: number): string => {
    const params = new URLSearchParams(location.search);
    if (targetPage <= 1) {
      params.delete(pageParam);
    } else {
      params.set(pageParam, String(targetPage));
    }
    const query = params.toString();
    return query ? `${location.pathname}?${query}` : location.pathname;
  };

  const baseItemClass =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-colors";
  const enabledClass =
    "border-stone-200 bg-white text-gray-700 hover:bg-[#E6F1FB] hover:text-[#0C447C]";
  const disabledClass = "border-stone-200 bg-stone-50 text-gray-300";
  const currentClass = "border-[#0C447C] bg-[#0C447C] text-white";

  return (
    <nav
      aria-label="Paginação de demandas"
      className={cn(
        "flex flex-wrap items-center justify-center gap-2 border-t border-stone-200 bg-white px-4 py-3",
        className,
      )}
    >
      {page > 1 ? (
        <Link
          to={buildHref(page - 1)}
          rel="prev"
          className={cn(baseItemClass, enabledClass)}
        >
          Anterior
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(baseItemClass, disabledClass)}>
          Anterior
        </span>
      )}

      <ul className="flex items-center gap-1">
        {getPageItems(page, totalPages).map((item) =>
          typeof item === "number" ? (
            <li key={item}>
              <Link
                to={buildHref(item)}
                aria-current={item === page ? "page" : undefined}
                aria-label={`Página ${item}`}
                className={cn(
                  baseItemClass,
                  item === page ? currentClass : enabledClass,
                )}
              >
                {item}
              </Link>
            </li>
          ) : (
            <li key={item} aria-hidden="true" className="px-1 text-xs text-gray-400">
              …
            </li>
          ),
        )}
      </ul>

      {page < totalPages ? (
        <Link
          to={buildHref(page + 1)}
          rel="next"
          className={cn(baseItemClass, enabledClass)}
        >
          Próxima
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(baseItemClass, disabledClass)}>
          Próxima
        </span>
      )}
    </nav>
  );
}

export default Pagination;
