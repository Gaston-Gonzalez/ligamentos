import Image from "next/image";
import { Ligamentosdle } from "@/components/Ligamentosdle";
import { getData } from "@/lib/data";
import { buildQuizPack, quizDayKey } from "@/lib/quiz";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Ligamentosdle",
  description:
    "Preguntas del plantel Ligamentos Cruzeiro: trivia del día, adiviná al jugador y racha.",
};

export default async function LigamentosdlePage() {
  const data = await getData();
  const pack = buildQuizPack(data, quizDayKey());

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-4">
        <Image
          src="/escudo.jpg"
          alt="Escudo Ligamentos Cruzeiro"
          width={72}
          height={72}
          className="h-16 w-16 rounded-full border-2 border-gold"
          priority
        />
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue">
            Serie 4 · Liga Pro
          </p>
          <h1 className="display text-5xl leading-none text-blue-deep md:text-7xl">
            Ligamentosdle
          </h1>
        </div>
      </div>
      <p className="mt-4 max-w-xl text-base text-muted">
        Preguntas armadas con el historial real del plantel. La trivia del día
        es la misma para todos y se renueva a la medianoche de Uruguay.
      </p>
      <Ligamentosdle pack={pack} />
    </div>
  );
}
