import DemandButton from "../../../features/public/components/demandButton";
import LoginButton from "../../../features/public/components/loginButton";
import EmergencyExitButton from "../../../shared/components/EmergencyExitButton";

const home = () => {
  return (
    <div className="min-h-screen flex flex-col bg-stone-100">
      <header className="w-full bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 py-6 lg:py-8 flex justify-center">
          <img
            src="/imagem_2.png"
            alt="Núcleo de Enfrentamento à Violência contra a Mulher"
            className="max-w-xs md:max-w-xs h-20 lg:h-27 object-contain"
            loading="eager"
          />
        </div>
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto flex flex-col justify-center items-center px-4 py-8 lg:p-12">
        <div className="text-2xl flex flex-col gap-2 md:text-3xl lg:text-4xl lg:gap-3">
          <h1 className="text-gray-800 tracking-tight font-bold text-center">
            PORTAL E-NEVIM
          </h1>
          <p className="font-semibold text-gray-600 text-lg md:text-xl lg:text-2xl leading-snug text-center">
            Portal de Acolhimento e Apoio Institucional - UESPI
          </p>
          <p className="text-sm md:text-[15px] text-gray-500 font-normal max-w-2xl leading-relaxed text-center">
            Canal confidencial e seguro para registrar sua demanda e receber
            acolhimento psicossocial.
          </p>
        </div>

        <div className="flex w-full max-w-full flex-wrap justify-center gap-4 px-1 mt-6 lg:mt-10 lg:px-0">
          <DemandButton />
          <LoginButton />
        </div>
      </main>
      <EmergencyExitButton />
      <footer className="w-full bg-white border-t border-stone-200 mt-auto">
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
};

export default home;
