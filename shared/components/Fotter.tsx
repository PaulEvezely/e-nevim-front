import { Link } from "react-router";

const Fotter = () => {
  return (
    <div>
      <footer className="bg-white border-t border-stone-200 mt-8">
        <div className="max-w-6xl mx-auto px-4 lg:px-12 py-8">
          <div className="flex flex-col sm:flex-row justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#0C447C] text-white grid place-items-center font-bold text-xs">
                  N
                </span>
                <span className="font-bold tracking-widest text-[#0C447C] text-sm">
                  NEVIM
                </span>
                <span className="text-stone-300 text-sm">|</span>
                <span className="text-xs text-gray-500">UESPI</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mt-3 max-w-sm">
                Núcleo de Proteção às Mulheres da UESPI. Acolhimento
                psicossocial e sigiloso para a comunidade acadêmica.
              </p>
            </div>

            <div className="flex gap-8 text-sm">
              <div>
                <p className="font-semibold text-gray-800 text-sm">Acesso</p>
                <ul className="mt-2 space-y-1.5 text-gray-600 text-sm">
                  <li>
                    <Link
                      to="/demanda"
                      className="hover:text-[#0C447C] hover:underline underline-offset-2"
                    >
                      Registrar demanda
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/login"
                      className="hover:text-[#0C447C] hover:underline underline-offset-2"
                    >
                      Acessar conta
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/terms"
                      className="hover:text-[#0C447C] hover:underline underline-offset-2"
                    >
                      Termos e LGPD
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-stone-100 flex flex-col sm:flex-row justify-between gap-2 text-xs text-gray-500">
            <p>
              © {new Date().getFullYear()} NEVIM • UESPI. Todos os direitos
              reservados.
            </p>
            <p>Ambiente seguro e sigiloso</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Fotter;
