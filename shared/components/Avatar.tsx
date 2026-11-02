export function Avatar({ nome, src }: { nome: string; src?: string }) {
  const iniciais = nome
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return src ? (
    <img className="avatar" src={src} alt={nome} />
  ) : (
    <div className="avatar avatar-placeholder">{iniciais}</div>
  );
}
