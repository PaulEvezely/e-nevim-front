import { Outlet, Link } from "react-router";
// shared/layouts/PublicLayout.tsx
export default function PublicLayout() {
  return (
    <div className="public-layout min-h-screen flex flex-col bg-stone-100">
      <div className="flex-1">
      <header className="app-header mb-4 lg:mb-7">
        <Link to="/" className="logo text-2xl lg:text-3xl">
          <header className="w-full bg-white border-b border-stone-200">
            <div className="max-w-6xl mx-auto px-4 py-6 lg:py-8 flex justify-center">
              <img
                src="/imagem_2.png"
                alt="Núcleo de Enfrentamento à Violência contra a Mulher"
                className="max-w-xs md:max-w-xs h-20 lg:h-22 object-contain"
                loading="eager"
              />
            </div>
          </header>
        </Link>
      </header>

      <main>
        <Outlet />
      </main>
      </div>
      <footer className="w-full bg-white border-t border-stone-200 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-6 flex justify-center">
          <img
            src="/imagem_3.png"
            alt="Logos institucionais: NEVIM, Universidade Estadual do Piauí, Secretaria da Segurança Pública SSP-PI, Governo do Piauí"
            className="w-full max-w-4xl h-auto object-contain"
            loading="lazy"
          />
        </div>
      </footer>
    </div>
  );
}
