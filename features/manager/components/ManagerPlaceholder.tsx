import { Link } from "react-router";

export function ManagerPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="mx-auto max-w-6xl" aria-label={title}>
      <h1 className="text-xl font-semibold text-gray-800 lg:text-2xl">{title}</h1>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">Nada por aqui ainda.</p>
        <Link
          to="/manager"
          className="mt-3 inline-block rounded-xl bg-[#378ADD] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#0C447C]"
        >
          Voltar ao início
        </Link>
      </div>
    </section>
  );
}

export default ManagerPlaceholder;
