import { useState } from "react";

type DayForecast = {
  day: string;
  icon: string;
  min: number;
  max: number;
  rain: string;
};

const TODAY = { temp: 32, condition: "Parcialmente nublado", max: 34, min: 24, humidity: 58, wind: 12 };

const NEXT_DAYS: DayForecast[] = [
  { day: "Amanhã", icon: "⛅", min: 24, max: 33, rain: "20%" },
  { day: "Quarta", icon: "🌧️", min: 23, max: 30, rain: "70%" },
  { day: "Quinta", icon: "⛅", min: 24, max: 32, rain: "30%" },
  { day: "Sexta", icon: "☀️", min: 25, max: 34, rain: "10%" },
  { day: "Sábado", icon: "☀️", min: 25, max: 35, rain: "5%" },
];

export function DecoyClima({ city = "Teresina" }: { city?: string }) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<string | null>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearched(query.trim());
    setQuery("");
  }

  return (
    <div
      role="document"
      aria-label="Previsão do tempo"
      className="min-h-screen w-full bg-gradient-to-b from-sky-100 to-white text-slate-800"
    >
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4">
        <p className="text-lg font-bold tracking-tight text-sky-900">
          Clima<span className="font-normal text-sky-600">Hoje</span>
        </p>
        <form onSubmit={handleSearch} className="flex items-center gap-2" role="search">
          <label htmlFor="decoy-city" className="sr-only">
            Buscar cidade
          </label>
          <input
            id="decoy-city"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cidade…"
            autoComplete="off"
            className="w-36 rounded-full border border-sky-200 bg-white px-3 py-1.5 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-sky-400 sm:w-48"
          />
          <button
            type="submit"
            className="rounded-full bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-sky-700"
          >
            Buscar
          </button>
        </form>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-12">
        <section
          aria-label={`Tempo agora em ${searched ?? city}`}
          className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-sky-100"
        >
          <p className="text-sm font-medium text-slate-500">
            Agora em {searched ?? city}
          </p>
          <div className="mt-1 flex items-center gap-4">
            <span aria-hidden="true" className="text-5xl">
              ⛅
            </span>
            <p className="text-6xl font-bold tracking-tight text-slate-900">
              {TODAY.temp}°
            </p>
            <div>
              <p className="text-base font-semibold text-slate-800">
                {TODAY.condition}
              </p>
              <p className="text-sm text-slate-500">
                Máx {TODAY.max}° · Mín {TODAY.min}°
              </p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Umidade", value: `${TODAY.humidity}%` },
              { label: "Vento", value: `${TODAY.wind} km/h` },
              { label: "Chuva", value: "20%" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl bg-sky-50 px-2 py-3 ring-1 ring-sky-100"
              >
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                  {item.label}
                </dt>
                <dd className="mt-0.5 text-base font-bold text-slate-800">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-label="Próximos dias" className="mt-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Próximos dias
          </h2>
          <ul className="mt-2 space-y-2">
            {NEXT_DAYS.map((d) => (
              <li
                key={d.day}
                className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100"
              >
                <span className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                  <span aria-hidden="true" className="text-xl">
                    {d.icon}
                  </span>
                  {d.day}
                </span>
                <span className="text-xs text-sky-700">🌧️ {d.rain}</span>
                <span className="text-sm text-slate-600">
                  {d.min}° <span className="font-bold text-slate-900">{d.max}°</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-6 text-center text-[11px] text-slate-400">
          Dados ilustrativos atualizados às 08:00 · Fonte: estação local
        </p>
      </main>
    </div>
  );
}

export default DecoyClima;
