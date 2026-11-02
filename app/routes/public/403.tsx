import { Link } from "react-router";

export default function ForbiddenPage() {
  return (
    <main className="max-w-xl mx-auto p-6 lg:p-10 text-center">
      <p
        aria-hidden="true"
        className="inline-block bg-[#FCEBEB] text-[#791F1F] text-xs font-semibold px-3 py-1 rounded-full"
      >
        Erro 403
      </p>
      <h1 className="mt-4 text-2xl font-semibold text-gray-800">
        Acesso negado
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Você não tem permissão para acessar esta área. Se precisar de acesso,
        fale com o gestor do NEVIM.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          to="/login"
          className="bg-[#378ADD] hover:bg-[#0C447C] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Voltar para o login
        </Link>
        <Link
          to="/"
          className="border border-stone-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-stone-50 transition-colors"
        >
          Ir para o início
        </Link>
      </div>
    </main>
  );
}
